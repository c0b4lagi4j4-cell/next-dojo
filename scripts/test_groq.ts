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

async function main() {
  console.log('\n=== Test Koneksi Groq API ===');
  console.log('Key:', process.env.GROQ_API_KEY?.slice(0, 10) + '...');
  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Ucapkan: OSH!! Koneksi Groq berhasil!' }],
      max_tokens: 50,
    });
    console.log('✅ BERHASIL! Respon:', res.choices[0]?.message?.content);
  } catch (err: any) {
    console.error('❌ GAGAL:', err.message);
  }
}

main();
