process.env.NODE_OPTIONS = '--openssl-legacy-provider';
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = process.env.SPREADSHEET_ID;

const COL = {
  TIMESTAMP: 0, SALES_NAME: 1, DEPARTMENT: 2, BILL_NO: 3, CUSTOMER: 4,
  AMOUNT: 5, VAT: 6, SHIPPING: 7, INSTALLMENT_NO: 8, PAID_AMOUNT: 9,
  BILL_URL: 10, SLIP_URL: 11, OPEN_DATE: 12, DELIVERY_DATE: 13,
  NOTE: 14, PHONE: 15, STATUS: 16, REASON: 17, NEXT_DATE: 18, NOTIFIED: 19,
};

async function getAllRows(sheetName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A2:T`,
    });
    return res.data.values || [];
  } catch (err) {
    console.error('Error getting rows:', err.message);
    return [];
  }
}

async function updateRow(sheetName, rowIndex, status, reason = '', nextDate = '', notified = '') {
  const rowNum = rowIndex + 2;
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!Q${rowNum}:T${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[status, reason, nextDate, notified]] },
    });
  } catch (err) {
    console.error('Error updating row:', err.message);
  }
}

async function getUnprocessedRows(sheetName) {
  const rows = await getAllRows(sheetName);
  return rows.map((row, index) => ({ row, index })).filter(({ row }) => !row[COL.STATUS]);
}

async function getPendingPayments(sheetName) {
  const rows = await getAllRows(sheetName);
  return rows.map((row, index) => ({ row, index })).filter(({ row }) => {
    const status = row[COL.STATUS] || '';
    return status !== 'ชำระครบ' && status !== 'ยกเลิก';
  });
}

module.exports = { COL, getAllRows, updateRow, getUnprocessedRows, getPendingPayments };
