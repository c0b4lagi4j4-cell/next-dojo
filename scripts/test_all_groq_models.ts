import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

try {
  const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && match[1] && match[2]) process.env[match[1]] = match[2].trim();
  });
} catch (e) { /* ignore */ }

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function testModel(modelId: string) {
  try {
    const start = Date.now();
    const res = await groq.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: 'Jawab satu kalimat saja dalam Bahasa Indonesia: Apa itu Karate?' }],
      max_tokens: 60,
    });
    const ms = Date.now() - start;
    const reply = res.choices[0]?.message?.content?.slice(0, 80) || '';
    return { status: '✅ OK', ms, reply };
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('429') || msg.includes('rate_limit')) return { status: '⛔ 429 Rate Limit', ms: 0, reply: 'Terlalu cepat' };
    if (msg.includes('404') || msg.includes('not found')) return { status: '❌ 404 Tidak Tersedia', ms: 0, reply: '' };
    if (msg.includes('decommissioned') || msg.includes('deprecated')) return { status: '🚫 Deprecated', ms: 0, reply: '' };
    return { status: `❓ Error`, ms: 0, reply: msg.slice(0, 60) };
  }
}

async function main() {
  console.log('\n=== Mengambil daftar model dari Groq API... ===\n');

  let models: any[] = [];
  try {
    const listRes = await groq.models.list();
    models = listRes.data || [];
    models.sort((a, b) => a.id.localeCompare(b.id));
  } catch (err) {
    console.error('Gagal mengambil daftar model:', err);
    return;
  }

  console.log(`Ditemukan ${models.length} model. Mulai pengujian...\n`);
  console.log('='.repeat(75));
  console.log(` ${'MODEL ID'.padEnd(45)} ${'STATUS'.padEnd(22)} ${'WAKTU'}`);
  console.log('='.repeat(75));

  const results: { id: string; context?: number; status: string; ms: number; reply: string }[] = [];

  for (const model of models) {
    process.stdout.write(` ${model.id.padEnd(45)} `);
    const result = await testModel(model.id);
    process.stdout.write(`${result.status.padEnd(22)} `);
    console.log(result.ms > 0 ? `${result.ms}ms` : '-');
    results.push({ id: model.id, context: model.context_window, ...result });
    await sleep(1200); // Jeda antar request agar tidak kena rate limit
  }

  console.log('='.repeat(75));
  console.log('\n📊 RINGKASAN:\n');

  const ok = results.filter(r => r.status.includes('✅'));
  const notOk = results.filter(r => !r.status.includes('✅'));

  console.log(`✅ Model yang BERFUNGSI (${ok.length}):`);
  ok.forEach(r => {
    console.log(`   • ${r.id.padEnd(45)} Context: ${r.context?.toLocaleString() || '?'} tokens | ${r.ms}ms`);
  });

  console.log(`\n❌ Model yang TIDAK BERFUNGSI (${notOk.length}):`);
  notOk.forEach(r => console.log(`   • ${r.id} → ${r.status}`));
  
  console.log('\n🏆 Model Terbaik untuk Chatbot Karate (rekomendasi):');
  const best = ok.sort((a, b) => (b.context || 0) - (a.context || 0)).slice(0, 3);
  best.forEach((r, i) => console.log(`   ${i + 1}. ${r.id} (${r.context?.toLocaleString()} tokens, ${r.ms}ms)`));
}

main();
