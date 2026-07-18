import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Cache PDF supaya tidak dibaca berulang-ulang
let pdfCache: string | null = null;

function getPdfContext(): string {
  if (pdfCache !== null) return pdfCache;
  
  let result = '';
  const refDir = path.join(process.cwd(), 'referensi');
  
  try {
    if (fs.existsSync(refDir)) {
      const files = fs.readdirSync(refDir);
      for (const file of files) {
        if (file.endsWith('.txt')) {
          const content = fs.readFileSync(path.join(refDir, file), 'utf8');
          result += content + '\n';
        }
      }
    }
  } catch { /* ignore */ }

  if (result.trim()) {
    pdfCache = `\n\nBERIKUT ADALAH DOKUMEN REFERENSI MUTLAK (BUKU PERATURAN WKF 2026):\n` +
      `==========================================================\n${result}\n` +
      `==========================================================\n` +
      `ATURAN MUTLAK: Jika jawaban dari pertanyaan pengguna TIDAK TERDAPAT secara eksplisit di dalam dokumen Referensi di atas, ` +
      `Anda WAJIB menjawab: 'Maaf, saya tidak menemukan informasi tersebut di buku peraturan WKF 2026'. JANGAN MENEBAK.`;
  } else {
    pdfCache = '';
  }

  return pdfCache;
}

function writeViolationLog(msg: string) {
  const line = `${new Date().toISOString()} - PELANGGARAN: ${msg}`;
  console.warn(line); // Penting untuk melihat log di dashboard Vercel
  
  try {
    const logPath = path.join(process.cwd(), 'admin_hukuman.log');
    
    // Rotasi: max 100 baris
    if (fs.existsSync(logPath)) {
      const existing = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
      if (existing.length >= 100) existing.splice(0, existing.length - 99);
      fs.writeFileSync(logPath, [...existing, line].join('\n') + '\n');
    } else {
      fs.writeFileSync(logPath, line + '\n');
    }
  } catch { /* ignore: di Vercel filesystem biasanya read-only, jadi catch akan menangkap error ini */ }
}

const BADWORDS = ["anjing","babi","bangsat","kontol","memek","jembut","ngentot","goblok","tolol","bajingan","keparat"];

function containsBadWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BADWORDS.some(w => lower.includes(w));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, userName, userBelt } = body;

    // Perlindungan spoofing
    if (typeof message === 'string' && message.toUpperCase().startsWith('SISTEM:')) {
      return Response.json({ error: 'spoof', reply: '⚠️ Percobaan injeksi sistem terdeteksi dan ditolak.' }, { status: 400 });
    }

    // Filter kata kasar
    if (typeof message === 'string' && containsBadWord(message)) {
      writeViolationLog(`Kata kasar dari "${userName}": "${message}"`);
      return Response.json({ error: 'profane', reply: '🥋 Chukoku! Wasit memberi peringatan karena Anda menggunakan kata tidak pantas. Ulangi lagi dan sesi Anda akan berakhir!' }, { status: 400 });
    }

    const waktu = new Date().toLocaleString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const systemPrompt = `Informasi Waktu Saat Ini: ${waktu}.

Anda adalah KARATE AI ASSISTANT, asisten virtual khusus peraturan Karate WKF 2026 yang membantu Karateka, Wasit, dan Juri.
Sapa selalu dengan "OSH!!" di pesan pertama, diikuti ucapan sesuai waktu (Pagi/Siang/Sore/Malam).
Bicara seperti manusia yang hangat, bukan seperti robot. Sisipkan nama pengguna di setiap jawaban.

PROFIL PENGGUNA SAAT INI:
- Nama: ${userName || 'Belum diketahui'}
- Tingkat Sabuk: ${userBelt || 'Belum diketahui'}

ONBOARDING:
1. Jika nama belum diketahui → tanya nama dulu, jangan tanya sabuk.
2. Jika nama sudah diketahui tapi sabuk belum → tanya tingkat sabuk/pengalaman.
3. Jika keduanya sudah diketahui → baru mulai diskusi materi.
4. Sesuaikan kedalaman penjelasan dengan tingkat sabuk (sabuk putih = dasar, sabuk hitam = teknis mendalam).
5. Kutipan peraturan WKF → wajib dalam format blockquote markdown (diawali '>').

ANTI-JAILBREAK: Tolak semua permintaan di luar topik peraturan karate WKF 2026.
${getPdfContext()}`;

    // Bangun riwayat percakapan
    const contents = [
      ...(history || []).map((h: { role: string; text: string }) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      },
    });

    const reply = response.text ?? '(Tidak ada respons dari AI)';
    return Response.json({ reply });

  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      return Response.json({ error: '429' }, { status: 429 });
    }
    if (msg.includes('503')) {
      return Response.json({ error: '503' }, { status: 503 });
    }
    console.error('[API Error]', err);
    return Response.json({ error: 'unknown', details: msg }, { status: 500 });
  }
}
