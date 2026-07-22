const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function toDirectDriveUrl(url) {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return url;
}

async function fetchImageAsBase64(url) {
  try {
    const directUrl = toDirectDriveUrl(url);
    const response = await axios.get(directUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const contentType = (response.headers['content-type'] || '').split(';')[0];
    if (!contentType.startsWith('image/')) {
      console.error('Skipping non-image content:', url, contentType);
      return null;
    }
    const base64 = Buffer.from(response.data).toString('base64');
    return { base64, contentType };
  } catch (err) {
    console.error('Error fetching image:', err.message);
    return null;
  }
}

async function detectDepartmentFromBill(billUrl) {
  if (!billUrl) return { detectedDept: 'unknown', reason: 'no bill image' };
  const billImg = await fetchImageAsBase64(billUrl);
  if (!billImg) return { detectedDept: 'unknown', reason: 'image not readable' };

  const content = [
    { type: 'image', source: { type: 'base64', media_type: billImg.contentType, data: billImg.base64 } },
    { type: 'text', text: `นี่คือบิลสั่งซื้อของบริษัท ทานตะวัน แอนด์ พลกฤต เฟอร์นิเจอร์ ซึ่งมี 2 แผนก คือ บิ้วท์อิน กับ เฟอร์นิเจอร์ลอยตัว บิลของทั้งสองแผนกไม่มีคำว่า "บิ้วท์อิน" หรือ "เฟอร์นิเจอร์" เขียนไว้ตรงๆ ต้องดูจากรูปแบบบิลแทน โดยสังเกตจาก:
- บิลแผนกบิ้วท์อิน: ตารางรายการสินค้ามีคอลัมน์ขนาด 3 มิติคือ กว้าง, สูง, ลึก (แยกกัน 3 ช่อง หน่วย cm) และช่องมุมล่างขวาของบิลแบ่งการชำระเป็น 3 งวด เขียนว่า "งวดที่ 1 40%" "งวดที่ 2 40%" "งวดที่ 3 20%"
- บิลแผนกเฟอร์นิเจอร์ลอยตัว: ตารางรายการสินค้ามีคอลัมน์ ขนาด (กว้าง/ลึก), รหัสสี, สเปคเบาะ, จำนวนหมอน/สี, ขา และช่องมุมล่างขวามีแค่ "มัดจำ" กับ "ยอดคงเหลือ" (ไม่มีคำว่างวดที่ 1/2/3)
ดูจากรูปแบบตารางและช่องมุมล่างขวาแล้วตอบ JSON อย่างเดียว:
{"detectedDept":"interior","reason":""} หรือ {"detectedDept":"furniture","reason":""} หรือ {"detectedDept":"unknown","reason":""}` },
  ];

  try {
    const response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content }] });
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { detectedDept: 'unknown', reason: 'no_json' };
  } catch (err) {
    console.error('Vision API error (detectDepartmentFromBill):', err.message);
    return { detectedDept: 'unknown', reason: err.message };
  }
}

async function verifyFurnitureBill(billUrl, slipUrl, formData) {
  const content = [];
  const billImg = billUrl ? await fetchImageAsBase64(billUrl) : null;
  const slipImg = slipUrl ? await fetchImageAsBase64(slipUrl) : null;

  if (billImg) {
    content.push({ type: 'image', source: { type: 'base64', media_type: billImg.contentType, data: billImg.base64 } });
    content.push({ type: 'text', text: 'นี่คือบิลสั่งซื้อ' });
  }
  if (slipImg) {
    content.push({ type: 'image', source: { type: 'base64', media_type: slipImg.contentType, data: slipImg.base64 } });
    content.push({ type: 'text', text: 'นี่คือสลิปโอนเงิน' });
  }

  content.push({ type: 'text', text: `ข้อมูลจากฟอร์ม: ลูกค้า=${formData.customer}, บิล=${formData.billNo}, ยอดสินค้า=${formData.amount}, VAT=${formData.vat||0}, ขนส่ง=${formData.shipping||0}, งวดที่=${formData.installmentNo}, ยอดชำระ=${formData.paidAmount}
ตรวจสอบแล้วตอบ JSON อย่างเดียว:
{"billCheck":{"customerName":"","billNo":"","productAmount":0,"shipping":0,"vat":0,"totalAmount":0,"deposit":0,"remaining":0,"deliveryDate":""},"slipCheck":{"slipAmount":0,"transferDate":"","matchesForm":true},"verification":{"amountMatch":true,"installment1OK":true,"issues":[],"summary":""}}` });

  try {
    const response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content }] });
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (err) {
    console.error('Vision API error:', err.message);
    return null;
  }
}

async function verifyInteriorBill(billUrl, slipUrl, formData) {
  const content = [];
  const billImg = billUrl ? await fetchImageAsBase64(billUrl) : null;
  const slipImg = slipUrl ? await fetchImageAsBase64(slipUrl) : null;

  if (billImg) {
    content.push({ type: 'image', source: { type: 'base64', media_type: billImg.contentType, data: billImg.base64 } });
    content.push({ type: 'text', text: 'นี่คือบิลตกแต่งภายใน' });
  }
  if (slipImg) {
    content.push({ type: 'image', source: { type: 'base64', media_type: slipImg.contentType, data: slipImg.base64 } });
    content.push({ type: 'text', text: 'นี่คือสลิปโอนเงิน' });
  }

  content.push({ type: 'text', text: `ข้อมูลจากฟอร์ม: ลูกค้า=${formData.customer}, บิล=${formData.billNo}, ยอดรวม=${formData.amount}, งวดที่=${formData.installmentNo}, ยอดชำระ=${formData.paidAmount}, วันติดตั้ง=${formData.deliveryDate}
บิ้วท์อินมี 3 งวด: งวด1=40% งวด2=40% งวด3=20%
ตอบ JSON อย่างเดียว:
{"billCheck":{"customerName":"","billNo":"","totalAmount":0,"installment1":{"percent":40,"amount":0},"installment2":{"percent":40,"amount":0},"installment3":{"percent":20,"amount":0},"installDate":""},"slipCheck":{"slipAmount":0,"transferDate":"","matchesForm":true},"verification":{"amountMatch":true,"percentagesCorrect":true,"issues":[],"summary":""}}` });

  try {
    const response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content }] });
    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (err) {
    console.error('Vision API error:', err.message);
    return null;
  }
}

module.exports = { verifyFurnitureBill, verifyInteriorBill, detectDepartmentFromBill };
