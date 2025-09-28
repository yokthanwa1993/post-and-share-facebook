# Post and Share

Command-line workflow that pulls text snippets from Google Sheets, posts them to Facebook Page A with a colored background, and shares the post to Page B.

## Requirements

- Node.js 18+
- A Facebook app/page access tokens with publish permissions for both pages (the backend now calls the Graph API via the official Facebook JavaScript SDK instead of raw curl calls)
- Google Cloud service account credentials with access to the target spreadsheet

## Environment variables

Create a `.env` file in the project root (or export these variables in your environment):

```
PAGE_A_ID=<facebook-page-a-id>
PAGE_A_TOKEN=<long-lived-page-a-token>
PAGE_B_ID=<facebook-page-b-id>
PAGE_B_TOKEN=<long-lived-page-b-token>
BACKGROUND_ID=<facebook-text-format-preset-id>
SPREADSHEET_ID=<google-spreadsheet-id>
SHEET_TAB_NAME=<sheet-tab-title>
USED_ROW_COLOR=#00FF00
👉 ใส่ค่าเป็นสตริง เช่น `USED_ROW_COLOR="#d9ead3"` เพื่อให้ `dotenv` ไม่ตัดทอนหลังเครื่องหมาย #
GOOGLE_SERVICE_ACCOUNT_KEY=./service-account-key.json # หรือวางค่า base64/JSON โดยตรงใน .env
CRON_SCHEDULE="*/15 * * * *" # จำเป็นต้องตั้งค่าเอง เลือกรูปแบบเวลาให้เหมาะกับงานของคุณ
RUN_ON_START=true
```

Place the Google service account JSON file at the location referenced by `GOOGLE_SERVICE_ACCOUNT_KEY`, หรือหากต้องการเก็บไว้ในตัวแปร ให้รัน `base64 service-account-key.json` แล้วนำผลลัพธ์มาใส่ใน `.env` ได้โดยตรง (รองรับทั้ง raw JSON และ base64 encoded JSON).

## Install & run

```bash
npm install
./post-and-share.sh
```

The shell script loads `.env`, ensures dependencies are installed, and then runs `node post-and-share.js`.

## Usage modes

### 1. Pull from Google Sheets ➜ post to Page A ➜ share to Page B

```bash
./post-and-share.sh
```

This is equivalent to the original automated workflow. The script:

1. Finds a random unused row (background color not yet marked) in the configured Google Sheet
2. Posts the text to Page A (using the Facebook JavaScript SDK)
3. Shares the resulting post to Page B
4. Marks the row as used by coloring it

### 2. Post a custom message directly to Page A (optional share)

```bash
./post-and-share.sh --message "ข้อความสำหรับเพจ A" --background 1026585199103318
```

- `--message` / `-m`: required text for direct mode
- `--background` / `-b`: optional background preset ID (falls back to `.env` value)
- `--no-share`: skip sharing to Page B when using `--message`

The Node entry point (`post-and-share.js`) can also be executed directly if preferred:

```bash
node post-and-share.js --message "ข้อความ" --no-share
```

### 3. Schedule automatic runs (node-cron)

ตั้ง `CRON_SCHEDULE` ใน `.env` (บังคับต้องมี ไม่เช่นนั้น scheduler จะไม่เริ่มทำงาน) เพื่อกำหนดความถี่ แล้วจึงสั่งรัน:

```bash
npm run schedule
```

Scheduler จะดึง `postFromSheetAndShare` ทำงานตาม cron pattern ที่คุณตั้งไว้ หากไม่กำหนด `CRON_SCHEDULE` โปรแกรมจะออกพร้อมแจ้งเตือนทันที. ตั้ง `RUN_ON_START=false` หากต้องการรอจนกว่าจะถึง tick แรกก่อนเริ่มงาน.

## Deploying on CapRover

1. **Secrets & environment** – in CapRover dashboard, set the following environment variables under *App Config*:
	- `PAGE_A_ID`, `PAGE_A_TOKEN`, `PAGE_B_ID`, `PAGE_B_TOKEN`
	- `SPREADSHEET_ID`, `SHEET_TAB_NAME`, `BACKGROUND_ID`, `USED_ROW_COLOR`
	- `GOOGLE_SERVICE_ACCOUNT_KEY` → upload the JSON as a mounted secret or use CapRover's *Config Files* feature and point the variable to its path
	- `CRON_SCHEDULE` (e.g. `"*/15 * * * *"`) and `RUN_ON_START`

2. **Deploy (แนะนำ)** – จากโฟลเดอร์โปรเจกต์ ให้ใช้ CapRover CLI สร้าง tarball และส่งขึ้นไปโดยตรง (วิธีนี้ไม่ต้องให้ CapRover ไป clone จาก GitHub):

```bash
caprover deploy --appName post-and-share-facebook --tarFile ./
```

CapRover builds the Docker image defined in `Dockerfile` and runs `node scheduler.js`. There is no HTTP server; logs are available via `caprover logs -a post-and-share-facebook`.

Check the server logs for detailed progress messages or errors.

> ⚠️ **หากใช้เมนู Git Repository ใน CapRover UI** จะต้องใส่ Personal Access Token (PAT) ของ GitHub ที่มีสิทธิ์อ่าน repo นี้ ไม่เช่นนั้นจะเกิด error `Invalid username or token`. วิธีที่ง่ายและปลอดภัยกว่าคือใช้คำสั่ง CLI ด้านบนเพื่อส่งซอร์สด้วยตัวเองทุกครั้งที่ต้องการ deploy.
