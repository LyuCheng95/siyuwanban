/**
 * 本地重新生成图片 Worker
 * 用法：node_modules\.bin\tsx src\regenWorker.ts
 *
 * 前置条件：
 *   1. ComfyUI 在 localhost:7188 运行
 *   2. SSH 隧道连接到远程 PostgreSQL（DATABASE_URL 已配置）
 *   3. 服务器在线（SERVER_URL 可访问）
 *
 * 工作流：
 *   1. 轮询服务器 /api/admin/regen-queue 获取 pending 任务
 *   2. 对每个任务运行 generateAlbum.ts 生成图片（本地 ComfyUI + DB 更新）
 *   3. 将新生成的文件上传到服务器
 */

import 'dotenv/config';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const SERVER_URL  = process.env.FRONTEND_URL   || 'https://siyuwanban.shangzongcai.com';
const ADMIN_KEY   = process.env.ADMIN_KEY      || 'sywb-admin-2026';
const SAVE_DIR    = (process.env.LOCAL_PORTRAIT_DIR || 'D:/SD/siyuwanban/portraits').replace(/\\/g, '/');
const WORKER_DIR  = path.resolve(__dirname, '..');

interface RegenJob {
  id: string; charId: string; charName: string; count: number;
  status: string; createdAt: string; error?: string; completedImages?: number;
}

async function apiGet(endpoint: string): Promise<any> {
  const sep = endpoint.includes('?') ? '&' : '?';
  const r = await fetch(`${SERVER_URL}/api/admin${endpoint}${sep}key=${ADMIN_KEY}`);
  return r.json();
}

async function apiPost(endpoint: string, body: object): Promise<any> {
  const sep = endpoint.includes('?') ? '&' : '?';
  const r = await fetch(`${SERVER_URL}/api/admin${endpoint}${sep}key=${ADMIN_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function apiPatch(endpoint: string, body: object): Promise<any> {
  const sep = endpoint.includes('?') ? '&' : '?';
  const r = await fetch(`${SERVER_URL}/api/admin${endpoint}${sep}key=${ADMIN_KEY}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function processJob(job: RegenJob): Promise<void> {
  console.log(`\n🎨 [${job.charName}] 开始生成 ${job.count} 张...`);
  await apiPatch(`/regen-queue/${job.id}`, { status: 'processing' });

  // 记录生成前已有文件的 mtime
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  const startTime = Date.now();

  // 调用 generateAlbum.ts 生成图片（自动更新 DB）
  const tsx    = path.join(WORKER_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const script = path.join(WORKER_DIR, 'src', 'generateAlbum.ts');

  const result = spawnSync(tsx, [script, job.charName, String(job.count)], {
    cwd: WORKER_DIR,
    env: { ...process.env },
    encoding: 'utf8',
    timeout: 600_000,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    const errMsg = (result.error?.message || 'generation failed').slice(0, 500);
    console.error(`❌ 生成失败: ${errMsg}`);
    await apiPatch(`/regen-queue/${job.id}`, { status: 'failed', error: errMsg });
    return;
  }

  // 找出新生成的文件（mtime >= startTime）
  const newFiles: string[] = [];
  for (const f of fs.readdirSync(SAVE_DIR)) {
    if (!f.endsWith('.png') && !f.endsWith('.jpg') && !f.endsWith('.jpeg')) continue;
    const mtime = fs.statSync(path.join(SAVE_DIR, f)).mtimeMs;
    if (mtime >= startTime) newFiles.push(f);
  }

  console.log(`  📁 发现 ${newFiles.length} 个新文件，上传中...`);

  let uploaded = 0;
  for (const filename of newFiles) {
    try {
      const filePath = path.join(SAVE_DIR, filename);
      const imageBase64 = fs.readFileSync(filePath).toString('base64');
      const r = await apiPost('/regen-upload', { filename, imageBase64, charId: job.charId });
      if (r.ok) {
        uploaded++;
        console.log(`  ✅ ${filename}`);
      } else {
        console.log(`  ⚠️  上传失败: ${filename} — ${r.error || ''}`);
      }
    } catch (e: any) {
      console.error(`  ❌ 上传错误: ${e.message}`);
    }
  }

  await apiPatch(`/regen-queue/${job.id}`, { status: 'done', completedImages: uploaded });
  console.log(`  ✨ 完成！已上传 ${uploaded} 张`);
}

async function main(): Promise<void> {
  console.log('🚀 Regen Worker 启动');
  console.log(`   服务器: ${SERVER_URL}`);
  console.log(`   本地目录: ${SAVE_DIR}`);
  console.log('   每 5s 轮询队列...\n');

  while (true) {
    try {
      const jobs: RegenJob[] = await apiGet('/regen-queue');
      const pending = jobs.filter(j => j.status === 'pending');
      if (pending.length > 0) {
        console.log(`📋 队列中有 ${pending.length} 个待处理任务`);
      }
      for (const job of pending) {
        await processJob(job);
      }
    } catch (e: any) {
      console.error('轮询错误:', e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

main().catch(console.error);
