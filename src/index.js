require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { startScheduler } = require('./services/schedulerService');
const { handlePostback, handleTextMessage, handleFormSubmit, processNewSheetRows } = require('./services/lineHandlerService');

const app = express();
const PORT = process.env.PORT || 3001;

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  res.json({ ok: true });
  const events = req.body.events || [];
  for (const event of events) {
    try {
      if (event.type === 'postback') {
        await handlePostback(event);
      } else if (event.type === 'message' && event.message.type === 'text') {
        await handleTextMessage(event);
      }
    } catch (err) {
      console.error('[Webhook] Event error:', err.message);
    }
  }
});

app.post('/form-submit', express.json(), handleFormSubmit);

app.get('/check-new-rows', async (req, res) => {
  const { secret, dept } = req.query;
  if (secret !== process.env.ANTHROPIC_API_KEY?.slice(-8)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const department = dept || 'furniture';
  const sheetName = process.env.SHEET_NAME || 'การตอบแบบฟอร์ม 1';
  processNewSheetRows(sheetName, department).catch(console.error);
  res.json({ ok: true, message: 'Processing started' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-verification-bot', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Payment Bot running on port ${PORT}`);
  startScheduler();
});