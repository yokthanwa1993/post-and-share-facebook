require('dotenv').config();

const SheetsService = require('./sheetsService');
const { createFacebookClient } = require('./facebookClient');

const config = {
  pageA_ID: process.env.PAGE_A_ID,
  pageB_ID: process.env.PAGE_B_ID,
  pageA_TOKEN: process.env.PAGE_A_TOKEN,
  pageB_TOKEN: process.env.PAGE_B_TOKEN,
  spreadsheetId: process.env.SPREADSHEET_ID,
  sheetTabName: process.env.SHEET_TAB_NAME,
  backgroundId: process.env.BACKGROUND_ID,
  usedRowColor: process.env.USED_ROW_COLOR
};

const sheetsService = new SheetsService();

function ensureConfig(keys) {
  const missing = keys.filter((key) => {
    const value = config[key];
    return typeof value === 'undefined' || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

async function findUnusedRow() {
  console.log('🔍 กำลังค้นหาแถวที่มีพื้นหลังสีขาว (ยังไม่ได้ใช้)...');

  const columnData = await sheetsService.getColumnValuesWithBackground(
    config.spreadsheetId,
    config.sheetTabName,
    'B',
    { usedRowColor: config.usedRowColor }
  );

  if (!columnData || columnData.length === 0) {
    throw new Error('ไม่พบข้อมูลใน Google Sheets');
  }

  console.log(`📊 พบข้อมูลทั้งหมด ${columnData.length} แถว`);

  const unusedRows = columnData.filter((row) => {
    return row.text && row.text.trim() !== '' && !row.isUsed;
  });

  console.log(`✅ พบแถวที่ยังไม่ได้ใช้: ${unusedRows.length} แถว`);

  if (unusedRows.length === 0) {
    return { selectedRow: null, selectedRowIndex: null };
  }

  const randomIndex = Math.floor(Math.random() * unusedRows.length);
  const selectedItem = unusedRows[randomIndex];

  console.log(`🎲 สุ่มเลือกแถว: ${selectedItem.rowIndex} จากทั้งหมด ${unusedRows.length} แถว`);
  console.log(`📝 ข้อความ: ${selectedItem.text.substring(0, 100)}${selectedItem.text.length > 100 ? '...' : ''}`);

  return {
    selectedRow: selectedItem.text,
    selectedRowIndex: selectedItem.rowIndex
  };
}

async function markRowAsUsed(rowIndex) {
  console.log(`🎨 กำลังเปลี่ยนสีแถว ${rowIndex} เป็นสี (${config.usedRowColor})...`);

  await sheetsService.markRowAsUsed(
    config.spreadsheetId,
    config.sheetTabName,
    rowIndex,
    config.usedRowColor
  );

  console.log(`✅ เปลี่ยนสีพื้นหลังแถว ${rowIndex} สำเร็จ - ทำเครื่องหมายว่าใช้แล้ว`);
}

async function postToPageA(message, options = {}) {
  ensureConfig(['pageA_ID', 'pageA_TOKEN']);

  console.log(`📘 กำลังโพสต์ไปเพจ A (ID: ${config.pageA_ID})...`);
  console.log(`📄 ข้อความ: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

  const payload = {
    message,
    access_token: config.pageA_TOKEN,
    published: options.published ?? true
  };

  const backgroundId = options.backgroundId ?? config.backgroundId;
  if (backgroundId) {
    payload.text_format_preset_id = backgroundId;
  }

  try {
    const fbClient = createFacebookClient(config.pageA_TOKEN);
    const response = await fbClient.api(
      `/${config.pageA_ID}/feed`,
      'post',
      payload
    );

    console.log(`✅ Facebook API Response: ${JSON.stringify(response)}`);
    return response.id;
  } catch (error) {
    const fbError = error.fbError;
    const errorMsg = fbError?.message || error.message;
    console.error('❌ Facebook Post Error - เพจ A:', fbError || errorMsg);
    throw new Error(`Failed to post to Page A: ${errorMsg}`);
  }
}

async function shareToPageB(postId) {
  ensureConfig(['pageB_ID', 'pageB_TOKEN']);

  const postLink = `https://www.facebook.com/${postId.replace('_', '/posts/')}`;
  console.log(`📤 กำลังแชร์ไปเพจ B (ID: ${config.pageB_ID})...`);
  console.log(`🔗 Post Link: ${postLink}`);

  try {
    const fbClient = createFacebookClient(config.pageB_TOKEN);
    const response = await fbClient.api(
      `/${config.pageB_ID}/feed`,
      'post',
      {
        link: postLink,
        access_token: config.pageB_TOKEN,
        published: true
      }
    );

    console.log(`✅ Facebook Share API Response: ${JSON.stringify(response)}`);
    return response.id;
  } catch (error) {
    const fbError = error.fbError;
    const errorMsg = fbError?.message || error.message;
    console.error('❌ Facebook Share Error - เพจ B:', fbError || errorMsg);

    if (fbError?.code === 200 || fbError?.code === 10) {
      console.error('🚫 ไม่มีสิทธิ์ - ตรวจสอบ Access Token และสิทธิ์เพจ');
    } else if (fbError?.code === 100) {
      console.error('⚠️ ข้อมูล request ไม่ถูกต้อง');
    }

    throw new Error(`Failed to share to Page B: ${errorMsg}`);
  }
}

async function postFromSheetAndShare() {
  ensureConfig([
    'pageA_ID',
    'pageA_TOKEN',
    'pageB_ID',
    'pageB_TOKEN',
    'spreadsheetId',
    'sheetTabName',
    'usedRowColor'
  ]);

  console.log('🚀 เริ่มกระบวนการโพสต์และแชร์...');

  const { selectedRow, selectedRowIndex } = await findUnusedRow();

  if (!selectedRow) {
    throw new Error('❌ ไม่พบข้อความที่ยังไม่ได้โพสต์');
  }

  const postId = await postToPageA(selectedRow);
  const shareId = await shareToPageB(postId);
  await markRowAsUsed(selectedRowIndex);

  const result = {
    success: true,
    postId,
    shareId,
    message: selectedRow,
    rowIndex: selectedRowIndex,
    postUrl: `https://www.facebook.com/${postId.replace('_', '/posts/')}`,
    shareUrl: `https://www.facebook.com/${shareId.replace('_', '/posts/')}`
  };

  console.log('🎉 กระบวนการทั้งหมดเสร็จสมบูรณ์!');
  console.log(JSON.stringify(result, null, 2));

  return result;
}

async function postDirectMessage(message, options = {}) {
  ensureConfig(['pageA_ID', 'pageA_TOKEN']);

  if (!message || !message.trim()) {
    throw new Error('Message is required when using direct post mode');
  }

  const postId = await postToPageA(message.trim(), options);

  let shareId = null;
  if (options.share) {
    shareId = await shareToPageB(postId);
  }

  const result = {
    success: true,
    postId,
    postUrl: `https://www.facebook.com/${postId.replace('_', '/posts/')}`,
    shareId,
    message: message.trim()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  postFromSheetAndShare,
  postDirectMessage,
  shareToPageB
};
