const cron = require('node-cron');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const { COL, getAllRows, updateRow } = require('./sheetsService');
const { sendToGroup, sendToOwner, buildReminderMessage } = require('./lineMessageService');

const SHEET_NAME = process.env.SHEET_NAME || 'การตอบแบบฟอร์ม 1';

function parseThaiDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const formats = ['D/M/YY', 'D/M/YYYY', 'DD/MM/YY', 'DD/MM/YYYY'];
  for (const fmt of formats) {
    const d = dayjs(str, fmt);
    if (d.isValid()) {
      if (d.year() > 2100) return d.subtract(543, 'year');
      return d;
    }
  }
  return null;
}

async function checkFurnitureReminders() {
  const rows = await getAllRows(SHEET_NAME);
  const today = dayjs();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = row[COL.STATUS] || '';
    const notified = row[COL.NOTIFIED] || '';
    const installmentNo = String(row[COL.INSTALLMENT_NO] || '').trim();
    const department = row[COL.DEPARTMENT] || '';
    if (String(department).includes('ตกแต่ง')) continue;
    if (status === 'ชำระครบ' || status === 'ยกเลิก') continue;
    if (notified === today.format('YYYY-MM-DD')) continue;
    if (installmentNo !== '1') continue;

    const deliveryDate = parseThaiDate(row[COL.DELIVERY_DATE]);
    if (!deliveryDate) continue;
    if (deliveryDate.format('YYYY-MM-DD') !== today.format('YYYY-MM-DD')) continue;

    const hasInstallment2 = rows.some(r => r[COL.BILL_NO] === row[COL.BILL_NO] && String(r[COL.INSTALLMENT_NO]).trim() === '2');
    if (!hasInstallment2) {
      const formData = { billNo: row[COL.BILL_NO], customer: row[COL.CUSTOMER], deliveryDate: row[COL.DELIVERY_DATE] };
      const messages = buildReminderMessage(formData, department, null);
      await sendToGroup(messages);
      await updateRow(SHEET_NAME, i, status || 'รอชำระงวด2', '', '', today.format('YYYY-MM-DD'));
      console.log(`[Reminder] Furniture bill ${row[COL.BILL_NO]} notified`);
    }
  }
}

async function checkInteriorReminders() {
  const rows = await getAllRows(SHEET_NAME);
  const today = dayjs();
  const threeDaysLater = today.add(3, 'day');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = row[COL.STATUS] || '';
    const notified = row[COL.NOTIFIED] || '';
    const installmentNo = String(row[COL.INSTALLMENT_NO] || '').trim();
    const department = row[COL.DEPARTMENT] || '';
    if (!String(department).includes('ตกแต่ง')) continue;
    if (status === 'ชำระครบ' || status === 'ยกเลิก') continue;
    if (notified === today.format('YYYY-MM-DD')) continue;
    if (installmentNo !== '1') continue;

    const deliveryDate = parseThaiDate(row[COL.DELIVERY_DATE]);
    if (!deliveryDate) continue;
    if (deliveryDate.format('YYYY-MM-DD') !== threeDaysLater.format('YYYY-MM-DD')) continue;

    const hasInstallment2 = rows.some(r => r[COL.BILL_NO] === row[COL.BILL_NO] && String(r[COL.INSTALLMENT_NO]).trim() === '2');
    if (!hasInstallment2) {
      const formData = { billNo: row[COL.BILL_NO], customer: row[COL.CUSTOMER], deliveryDate: row[COL.DELIVERY_DATE] };
      const nichapId = process.env.NICHAPA_LINE_USER_ID;
      const messages = buildReminderMessage(formData, department, nichapId);
      await sendToGroup(messages);
      await updateRow(SHEET_NAME, i, status || 'รอชำระงวด2', '', '', today.format('YYYY-MM-DD'));
      console.log(`[Reminder] Interior bill ${row[COL.BILL_NO]} notified`);
    }
  }
}

async function sendMonthlySummary() {
  const rows = await getAllRows(SHEET_NAME);
  const pending = rows.filter(r => r[COL.STATUS] && r[COL.STATUS] !== 'ชำระครบ' && r[COL.STATUS] !== 'ยกเลิก');
  const furniture = pending.filter(r => !String(r[COL.DEPARTMENT]||'').includes('ตกแต่ง'));
  const interior = pending.filter(r => String(r[COL.DEPARTMENT]||'').includes('ตกแต่ง'));
  const month = dayjs().format('MM/YYYY');
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`;
  const summaryText = `📊 รายงานสรุปสิ้นเดือน ${month}\n\n🪑 เฟอร์นิเจอร์: ${furniture.length} รายการค้างชำระ\n🏠 ตกแต่งภายใน: ${interior.length} รายการค้างชำระ\n📋 รวม: ${pending.length} รายการ\n\nดูรายละเอียด:\n${sheetUrl}`;
  await sendToOwner({ type: 'text', text: summaryText });
  console.log('[Monthly] Summary sent');
}

function startScheduler() {
  cron.schedule('0 18 * * *', () => {
    console.log('[Cron] Checking furniture reminders...');
    checkFurnitureReminders();
  }, { timezone: 'Asia/Bangkok' });

  cron.schedule('0 9 * * *', () => {
    console.log('[Cron] Checking interior reminders...');
    checkInteriorReminders();
  }, { timezone: 'Asia/Bangkok' });

  cron.schedule('0 20 28-31 * *', () => {
    const today = dayjs();
    if (today.add(1, 'day').month() !== today.month()) {
      console.log('[Cron] Sending monthly summary...');
      sendMonthlySummary();
    }
  }, { timezone: 'Asia/Bangkok' });

  console.log('✅ Scheduler started');
}

module.exports = { startScheduler, checkFurnitureReminders, checkInteriorReminders, sendMonthlySummary };