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
  const ownerId = process.env.OWNER_LINE_USER_ID;
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

function buildInteriorVerificationMessage(formData, result) {
  const v = result?.verification || {};
  const b = result?.billCheck || {};
  const s = result?.slipCheck || {};
  const statusOK = v.amountMatch && v.percentagesCorrect && (!v.issues || v.issues.length === 0);
  const statusColor = statusOK ? '#27AE60' : '#E74C3C';
  const statusText = statusOK ? '✅ ผ่านการตรวจสอบ' : '⚠️ พบข้อผิดพลาด';

  return {
    type: 'flex', altText: `ตรวจสอบบิล ${formData.billNo} - ${formData.customer}`,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: statusColor, contents: [
        { type: 'text', text: '🏠 แผนกตกแต่งภายใน', color: '#ffffff', size: 'sm' },
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
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ยอดรวม', color: '#333333', size: 'sm', flex: 2, weight: 'bold' },
          { type: 'text', text: `${Number(b.totalAmount||formData.amount||0).toLocaleString()} บาท`, size: 'sm', flex: 3, weight: 'bold' },
        ]},
        { type: 'separator' },
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'งวด 1 (40%)', color: '#2980B9', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(b.installment1?.amount||0).toLocaleString()} บาท`, size: 'sm', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'งวด 2 (40%)', color: '#8E44AD', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(b.installment2?.amount||0).toLocaleString()} บาท`, size: 'sm', flex: 3 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'งวด 3 (20%)', color: '#E67E22', size: 'sm', flex: 2 },
          { type: 'text', text: `${Number(b.installment3?.amount||0).toLocaleString()} บาท`, size: 'sm', flex: 3 },
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
          { type: 'text', text: 'วันติดตั้ง', color: '#888888', size: 'sm', flex: 2 },
          { type: 'text', text: formData.deliveryDate||b.installDate||'-', size: 'sm', flex: 3 },
        ]},
      ]},
      footer: { type: 'box', layout: 'vertical', contents: [
        { type: 'text', text: v.summary||'', size: 'xs', color: '#888888', wrap: true },
      ]},
    },
  };
}

function buildReminderMessage(formData, department, tagUserId) {
  const isFurniture = !String(department).includes('ตกแต่ง');
  const deptText = isFurniture ? '🪑 เฟอร์นิเจอร์' : '🏠 ตกแต่งภายใน';
  const installmentText = isFurniture ? 'งวด 2 (ยอดคงเหลือ)' : 'งวด 2 (ก่อนติดตั้ง)';

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