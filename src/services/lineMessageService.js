const line = require('@line/bot-sdk');

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function sendToGroup(messages) {
  const groupId = process.env.LINE_GROUP_ID;
  if (!groupId) return;
  const msgArray = Array.isArray(messages) ? messages : [messages];
  try {
    await client.pushMessage({ to: groupId, messages: msgArray });
  } catch (err) {
    console.error('Error sending to group:', err.message);
  }
}

async function sendToOwner(messages) {
const ownerId = process.env.LINE_OWNER_ID;
  if (!ownerId) return;
  const msgArray = Array.isArray(messages) ? messages : [messages];
  try {
    await client.pushMessage({ to: ownerId, messages: msgArray });
  } catch (err) {
    console.error('Error sending to owner:', err.message);
  }
}

function buildFurnitureVerificationMessage(formData, result) {
  const v = result?.verification || {};
  const b = result?.billCheck || {};
  const s = result?.slipCheck || {};
  const statusOK = v.amountMatch && v.installment1OK && (!v.issues || v.issues.length === 0);
  const statusColor = statusOK ? '#27AE60' : '#E74C3C';
  const statusText = statusOK ? '✅ ผ่านการตรวจสอบ' : '⚠️ พบข้อผิดพลาด';

  return {
    type: 'flex', altText: `ตรวจสอบบิล ${formData.billNo} - ${formData.customer}`,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: statusColor, contents: [
        { type: 'text', text: '🪑 แผนกเฟอร์นิเจอร์', color: '#ffffff', size: 'sm' },
        { type: 'text', text: statusText, color: '#ffffff', size: 'lg', weight: 'bold' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ลูกค้า', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: formData.customer, size: 'sm', flex: 3, wrap: true },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'เลขบิล', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: String(formData.billNo), size: 'sm', flex: 3 },
        ]},
        { type: 'separator' },
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ยอดสินค้า', color: '#555555', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(b.productAmount||formData.amount||0).toLocaleString()} บาท`, size: 'sm', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'มัดจำ', color: '#2980B9', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(b.deposit||formData.paidAmount||0).toLocaleString()} บาท`, size: 'sm', flex: 3, color: '#2980B9' },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ยอดคงเหลือ', color: '#E67E22', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(b.remaining||0).toLocaleString()} บาท`, size: 'sm', flex: 3, color: '#E67E22' },
        ]},
        { type: 'separator' },
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'สลิป', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(s.slipAmount||0).toLocaleString()} บาท`, size: 'sm', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ยอดตรงกัน', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: s.matchesForm ? '✅ ใช่' : '❌ ไม่ตรง', size: 'sm', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'กำหนดส่ง', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: formData.deliveryDate||b.deliveryDate||'-', size: 'sm', flex: 3 },
        ]},
      ]},
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'text', text: v.summary||'', size: 'xs', color: '#888888', wrap: true },
      ]},
    },
  };
}

function buildInteriorVerificationMessage(formData, summary) {
  const s = summary || {};
  const slots = s.slots || {};
  const statusMap = {
    complete: { color: '#27AE60', text: '✅ ชำระครบถ้วน' },
    waiting: { color: '#2980B9', text: '⏳ รอชำระงวดถัดไป' },
    mismatch: { color: '#E74C3C', text: '⚠️ พบข้อผิดพลาด ยอดไม่ตรง' },
  };
  const st = statusMap[s.statusKey] || statusMap.waiting;

  function installmentRow(label, slot) {
    const received = !!slot;
    return { type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: label, color: '#888888', size: 'sm', flex: 2 },
      { type: 'text', text: received ? String(slot.date || '-') : 'ยังไม่ได้รับ', size: 'sm', flex: 2, color: received ? '#333333' : '#E74C3C' },
      { type: 'text', text: received ? `${Number(slot.amount||0).toLocaleString()} บ.` : '-', size: 'sm', flex: 2, align: 'end' },
    ]};
  }

  const extraRows = (s.extras || []).map(function (ex) {
    return { type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: ex.label || 'อื่นๆ', color: '#8E44AD', size: 'sm', flex: 2 },
      { type: 'text', text: String(ex.date || '-'), size: 'sm', flex: 2 },
      { type: 'text', text: `${Number(ex.amount||0).toLocaleString()} บ.`, size: 'sm', flex: 2, align: 'end' },
    ]};
  });

  const diffOK = Math.abs(s.diff || 0) <= (s.tolerance || 0);

  return {
    type: 'flex', altText: `ตรวจสอบบิล ${formData.billNo} - ${formData.customer}`,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: st.color, contents: [
        { type: 'text', text: '🏠 แผนกบิ้วท์อิน', color: '#ffffff', size: 'sm' },
        { type: 'text', text: st.text, color: '#ffffff', size: 'lg', weight: 'bold' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ลูกค้า', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: formData.customer, size: 'sm', flex: 3, wrap: true },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'เลขบิล', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: String(formData.billNo), size: 'sm', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ยอดรวมที่ต้องชำระ', color: '#333333', size: 'sm', flex: 2, weight: 'bold' },
          { type: 'text', text: `${Number(s.totalDue||0).toLocaleString()} บาท`, size: 'sm', flex: 3, weight: 'bold' },
        ]},
        { type: 'separator' },
        installmentRow('งวดที่ 1', slots['1']),
        installmentRow('งวดที่ 2', slots['2']),
        installmentRow('งวดที่ 3', slots['3']),
        ...extraRows,
        { type: 'separator' },
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ยอดรับรวม', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(s.sumReceived||0).toLocaleString()} บาท`, size: 'sm', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ผลต่าง', color: diffOK ? '#27AE60' : '#E74C3C', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(s.diff||0).toLocaleString()} บาท`, size: 'sm', flex: 3 },
        ]},
      ]},
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'text', text: s.statusKey === 'waiting' ? 'ยังอยู่ระหว่างชำระ รอครบทั้ง 3 งวด' : (s.statusKey === 'complete' ? 'ยอดชำระรวมตรงกับยอดที่ต้องชำระ' : 'ยอดชำระรวมไม่ตรงกับยอดที่ต้องชำระ กรุณาตรวจสอบ'), size: 'xs', color: '#888888', wrap: true },
      ]},
    },
  };
}

function buildReminderMessage(formData, department, tagUserId) {
  const isFurniture = !String(department).includes('บิ้วท์อิน');
  const deptText = isFurniture ? '🪑 เฟอร์นิเจอร์' : '🏠 บิ้วท์อิน';
  const installmentText = isFurniture ? 'งวด 2 (ยอดคงเหลือ)' : 'งวดถัดไป';

  const reminderText = { type: 'text', text: `⏰ แจ้งเตือน!\n${deptText} | บิล ${formData.billNo}\nลูกค้า: ${formData.customer}\nยังไม่ได้รับสลิป${installmentText}` };

  const reasonButtons = {
    type: 'flex', altText: 'แจ้งเหตุผลที่ยังไม่ชำระ',
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'text', text: 'กรุณาแจ้งเหตุผล', weight: 'bold', size: 'md' },
        { type: 'text', text: `บิล ${formData.billNo} - ${formData.customer}`, size: 'sm', color: '#888888' },
      ]},
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '📅 ลูกค้าขอเลื่อน', data: `action=reason&billNo=${formData.billNo}&dept=${department}&reason=customer_postpone` } },
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '🏭 ผลิตไม่ทัน', data: `action=reason&billNo=${formData.billNo}&dept=${department}&reason=production_delay` } },
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '🔧 สินค้ามีตำหนิ', data: `action=reason&billNo=${formData.billNo}&dept=${department}&reason=defective` } },
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '📦 ส่งของบางส่วน', data: `action=reason&billNo=${formData.billNo}&dept=${department}&reason=partial_delivery` } },
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: '📝 อื่นๆ', data: `action=reason&billNo=${formData.billNo}&dept=${department}&reason=other` } },
      ]},
    },
  };
  return [reminderText, reasonButtons];
}

function buildAskNextDateMessage(billNo, customer, reason) {
  const reasonText = { customer_postpone:'ลูกค้าขอเลื่อน', production_delay:'ผลิตไม่ทัน', defective:'สินค้ามีตำหนิ', partial_delivery:'ส่งของบางส่วน', other:'อื่นๆ' }[reason] || reason;
  return { type: 'text', text: `✅ บันทึกเหตุผล: ${reasonText}\nบิล ${billNo} - ${customer}\n\nกรุณาพิมพ์วันนัดจัดส่ง/ติดตั้งครั้งถัดไป\nรูปแบบ: วัน/เดือน/ปี เช่น 25/7/2568` };
}

module.exports = { client, sendToGroup, sendToOwner, buildFurnitureVerificationMessage, buildInteriorVerificationMessage, buildReminderMessage, buildAskNextDateMessage };
