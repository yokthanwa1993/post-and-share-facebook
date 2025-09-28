#!/usr/bin/env node

require('dotenv').config();

const { postFromSheetAndShare, postDirectMessage } = require('./services/postWorkflow');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--message' || arg === '-m') {
      args.message = argv[++i];
    } else if (arg === '--background' || arg === '-b') {
      args.backgroundId = argv[++i];
    } else if (arg === '--no-share') {
      args.share = false;
    } else {
      // Positional fallback for message
      if (!args.message) {
        args.message = arg;
      }
    }
  }
  return args;
}

function printHelp() {
  console.log(`ใช้: node post-and-share.js [ตัวเลือก]\n\n` +
    `หากไม่ส่ง --message จะดึงข้อความจาก Google Sheets โดยอัตโนมัติแล้วโพสต์ไปเพจ A และแชร์ไปเพจ B\n` +
    `หากส่ง --message จะโพสต์ข้อความนั้นไปเพจ A ทันที (ข้าม Google Sheets)\n\n` +
    `ตัวเลือก:\n` +
    `  -m, --message <ข้อความ>    โพสต์ข้อความตรงไปเพจ A\n` +
    `  -b, --background <ID>      ระบุ preset background ของ Facebook (override ค่าใน .env)\n` +
    `      --no-share             ใช้กับโหมด message เพื่อไม่แชร์ไปเพจ B\n` +
    `  -h, --help                 แสดงข้อมูลช่วยเหลือ\n`);
}

(async () => {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    return;
  }

  try {
    if (args.message) {
      await postDirectMessage(args.message, {
        backgroundId: args.backgroundId,
        share: args.share !== false
      });
    } else {
      await postFromSheetAndShare();
    }
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.fbError) {
      console.error('รายละเอียดเพิ่มเติม:', error.fbError);
    }
    process.exit(1);
  }
})();
