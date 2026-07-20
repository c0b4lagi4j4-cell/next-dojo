import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

try {
  const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) process.env[match[1]] = match[2];
  });
} catch (e) { /* ignore */ }

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function testModel(modelName: string) {
  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: 'Jawab dengan satu kata saja: Halo',
      config: { maxOutputTokens: 10 },
    });
    return { status: '✅ OK', reply: res.text?.trim() };
  } catch (err: any) {
    const code = err?.status || '?';
    const msg = err?.message?.slice(0, 80) || String(err).slice(0, 80);
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return { status: '⛔ 429 QUOTA', reply: 'Kuota habis' };
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return { status: '❌ 404 NOT FOUND', reply: 'Model tidak tersedia' };
    }
    if (msg.includes('400') || msg.includes('INVALID')) {
      return { status: '🔑 400 KEY INVALID', reply: 'API Key tidak valid' };
    }
    return { status: `❓ ${code} ERROR`, reply: msg };
  }
}

async function main() {
  console.log('\n==================================================');
  console.log(' UJI MODEL GEMINI — API KEY ANDA');
  console.log('==================================================\n');

  for (const model of MODELS) {
    process.stdout.write(`Menguji ${model.padEnd(30)} ... `);
    const result = await testModel(model);
    console.log(`${result.status}   (${result.reply})`);
    // Jeda 2 detik antar model agar tidak kena rate limit per menit
    await sleep(2000);
  }

  console.log('\n==================================================');
  console.log(' Pengujian selesai!');
  console.log('==================================================\n');
}

main();
