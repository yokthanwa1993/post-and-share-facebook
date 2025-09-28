#!/usr/bin/env node

require('dotenv').config();

const cron = require('node-cron');
const { postFromSheetAndShare } = require('./services/postWorkflow');

const schedule = process.env.CRON_SCHEDULE;

if (!schedule) {
  console.error('❌ Missing CRON_SCHEDULE environment variable. Please set it in your .env or deployment config.');
  process.exit(1);
}

if (!cron.validate(schedule)) {
  console.error(`❌ Invalid CRON_SCHEDULE: ${schedule}`);
  process.exit(1);
}

let isRunning = false;

async function runJob() {
  if (isRunning) {
    console.warn('⚠️ Previous job still running, skipping this cycle.');
    return;
  }

  isRunning = true;
  const startedAt = new Date();
  console.log(`⏱️  ${startedAt.toISOString()} — Starting post-and-share job`);

  try {
    await postFromSheetAndShare();
    const finishedAt = new Date();
    console.log(`✅ ${finishedAt.toISOString()} — Job finished in ${(finishedAt - startedAt) / 1000}s`);
  } catch (error) {
    console.error('❌ Job failed:', error.message);
    if (error.fbError) {
      console.error('Facebook error detail:', error.fbError);
    }
  } finally {
    isRunning = false;
  }
}

console.log(`🕒 Scheduler started with CRON pattern: ${schedule}`);
cron.schedule(schedule, () => {
  runJob();
});

if (process.env.RUN_ON_START !== 'false') {
  runJob();
}
