const { COL, getAllRows, updateRow, getUnprocessedRows, getRowsByBillNo } = require('./sheetService');
const { verifyFurnitureBill, detectDepartmentFromBill } = require('./visionService');
const { sendToGroup, buildFurnitureVerificationMessage, buildInteriorVerificationMessage, buildAskNextDateMessage } = require('./lineMessageService');

const pendingNextDate = {};
const SHEET_NAME = process.env.SHEET_NAME || 'การตอบแบบฟอร์ม 1';

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function computeInteriorSummary(formData, historyRows) {
  const slots = { '1': null, '2': null, '3': null };
  const extras = [];

  for (const { row } of historyRows) {
    const instRaw = String(row[COL.INSTALLMENT_NO] || '').trim();
    const date = row[COL.TIMESTAMP] || '';
    const amount = Number(row[COL.PAID_AMOUNT]) || 0;
    if (instRaw === '1' || instRaw === '2' || instRaw === '3') {
      slots[instRaw] = { date, amount };
    } else {
      extras.push({ label: instRaw || 'อื่นๆ', date, amount });
    }
  }

  const totalDue = Number(formData.amount || 0) + Number(formData.vat || 0) + Number(formData.shipping || 0);
  const slotSum = ['1', '2', '3'].reduce((sum, k) => sum + (slots[k] ? slots[k].amount : 0), 0);
  const extraSum = extras.reduce((sum, e) => sum + (e.amount || 0), 0);
  const sumReceived = slotSum + extraSum;
  const tolerance = Math.max(500, totalDue * 0.02);
  const diff = totalDue - sumReceived;
  const allThreeReceived = ['1', '2', '3'].every((k) => slots[k]);

  let statusKey;
  if (diff < -tolerance) {
    statusKey = 'mismatch';
  } else if (allThreeReceived) {
    statusKey = Math.abs(diff) <= tolerance ? 'complete' : 'mismatch';
  } else {
    statusKey = 'waiting';
  }

  return { slots, extras, totalDue, sumReceived, diff, tolerance, statusKey, allThreeReceived };
}

async function resolveDepartment(formData) {
  const sheetIsFurniture = !String(formData.department).includes('บิ้วท์อิน');
  const detection = formData.billUrl ? await detectDepartmentFromBill(formData.billUrl) : { detectedDept: 'unknown' };

  let isFurniture = sheetIsFurniture;
  let mismatchNote = '';

  if (detection.detectedDept === 'interior' && sheetIsFurniture) {
    isFurniture = false;
    mismatchNote = `⚠️ ฟอร์มระบุแผนกเฟอร์นิเจอร์ แต่ตรวจจากรูปบิลพบรูปแบบของแผนกบิ้วท์อิน (มีงวดที่ 1/2/3) ระบบใช้ผลจากรูปบิลแทน กรุณาตรวจสอบข้อมูลในฟอร์ม`;
  } else if (detection.detectedDept === 'furniture' && !sheetIsFurniture) {
    isFurniture = true;
    mismatchNote = `⚠️ ฟอร์มระบุแผนกบิ้วท์อิน แต่ตรวจจากรูปบิลพบรูปแบบของแผนกเฟอร์นิเจอร์ (มัดจำ/ยอดคงเหลือ) ระบบใช้ผลจากรูปบิลแทน กรุณาตรวจสอบข้อมูลในฟอร์ม`;
  }

  return { isFurniture, mismatchNote, detectedDept: detection.detectedDept };
}

async function processNewSheetRows(sheetName, department) {
  const unprocessed = await getUnprocessedRows(sheetName);
  for (const { row, index } of unprocessed) {
    const formData = {
      salesName: row[COL.SALES_NAME], department: row[COL.DEPARTMENT] || department,
      billNo: row[COL.BILL_NO], customer: row[COL.CUSTOMER],
      amount: row[COL.AMOUNT], vat: row[COL.VAT] || 0, shipping: row[COL.SHIPPING] || 0,
      installmentNo: row[COL.INSTALLMENT_NO], paidAmount: row[COL.PAID_AMOUNT],
      billUrl: row[COL.BILL_URL], slipUrl: row[COL.SLIP_URL],
      openDate: row[COL.OPEN_DATE], deliveryDate: row[COL.DELIVERY_DATE],
      phone: row[COL.PHONE],
    };

    console.log(`[Process] Bill ${formData.billNo} - ${formData.customer}`);
    await sendToGroup({ type: 'text', text: `🔍 กำลังตรวจสอบ...\nบิล ${formData.billNo} | ${formData.customer}\nงวดที่ ${formData.installmentNo}` });

    try {
      const { isFurniture, mismatchNote } = await resolveDepartment(formData);
      let verifyMsg, newStatus;

      if (isFurniture) {
        const result = await verifyFurnitureBill(formData.billUrl, formData.slipUrl, formData);
        verifyMsg = buildFurnitureVerificationMessage(formData, result);
        const issues = result?.verification?.issues || [];
        const amountMatch = result?.verification?.amountMatch;
        newStatus = amountMatch && issues.length === 0 ? 'ตรวจแล้ว-ถูกต้อง' : 'ตรวจแล้ว-มีปัญหา';
      } else {
        const history = await getRowsByBillNo(sheetName, formData.billNo, formData.customer);
        const summary = computeInteriorSummary(formData, history);
        verifyMsg = buildInteriorVerificationMessage(formData, summary);
        newStatus = summary.statusKey === 'complete' ? 'ตรวจแล้ว-ถูกต้อง'
          : summary.statusKey === 'waiting' ? 'รอชำระงวดถัดไป'
          : 'ตรวจแล้ว-มีปัญหา';
      }

      if (mismatchNote) {
        await sendToGroup({ type: 'text', text: mismatchNote });
      }
      await sendToGroup(verifyMsg);
      await updateRow(sheetName, index, newStatus);
    } catch (err) {
      console.error(`[Process] Error:`, err.message);
      await sendToGroup({ type: 'text', text: `⚠️ ไม่สามารถตรวจสอบบิล ${formData.billNo} ได้` });
      await updateRow(sheetName, index, 'ตรวจไม่ได้-error');
    }

    await sleep(1500);
  }
}

async function handlePostback(event) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');
  const billNo = data.get('billNo');
  const dept = data.get('dept');
  const reason = data.get('reason');
  const userId = event.source.userId;

  if (action === 'reason') {
    const rows = await getAllRows(SHEET_NAME);
    const found = rows.find(r => String(r[COL.BILL_NO]) === String(billNo));
    const customer = found ? found[COL.CUSTOMER] : '';
    pendingNextDate[userId] = { billNo, customer, dept, reason, sheetName: SHEET_NAME };
    const msg = buildAskNextDateMessage(billNo, customer, reason);
    await sendToGroup(msg);
  }
}

async function handleTextMessage(event) {
  const userId = event.source.userId;
  console.log('[Debug] groupId:', event.source.groupId, 'userId:', event.source.userId);
  const text = event.message.text?.trim();
  if (pendingNextDate[userId]) {
    const { billNo, customer, dept, reason, sheetName } = pendingNextDate[userId];
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
    if (datePattern.test(text)) {
      const rows = await getAllRows(sheetName);
      const found = rows.findIndex(r => String(r[COL.BILL_NO]) === String(billNo) && String(r[COL.INSTALLMENT_NO]).trim() === '1');
      if (found !== -1) {
        const reasonLabels = { customer_postpone:'ลูกค้าขอเลื่อน', production_delay:'ผลิตไม่ทัน', defective:'สินค้ามีตำหนิ', partial_delivery:'ส่งของบางส่วน', other:'อื่นๆ' };
        await updateRow(sheetName, found, 'รอชำระ-เลื่อนวัน', reasonLabels[reason]||reason, text, '');
      }
      delete pendingNextDate[userId];
      await sendToGroup({ type: 'text', text: `✅ บันทึกแล้ว\nบิล ${billNo} - ${customer}\n📅 วันนัดใหม่: ${text}` });
    }
  }
}

async function handleFormSubmit(req, res) {
  try {
    res.json({ ok: true });
    await processNewSheetRows(SHEET_NAME, req.body.department || '');
  } catch (err) {
    console.error('[FormSubmit]', err.message);
  }
}

module.exports = { processNewSheetRows, handlePostback, handleTextMessage, handleFormSubmit };
