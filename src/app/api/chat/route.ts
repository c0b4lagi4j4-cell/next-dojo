import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

// Model Groq yang dipakai — Llama 3.1 8B: lebih ringan, limit lebih besar, anti error 429
const GROQ_MODEL = 'llama-3.1-8b-instant';

// Simple memory cache untuk file yang sudah pernah dibaca agar tidak terus membaca dari disk
const fileCache: Record<string, string> = {};

function getPdfContext(message: string): string {
  let result = '';
  const refDir = path.join(process.cwd(), 'referensi');
  const msg = message.toLowerCase();
  
  // Heuristik Deteksi Topik
  const isKata = msg.includes('kata') || msg.includes('bunkai') || msg.includes('enpi') || msg.includes('unsu');
  const isKumite = msg.includes('kumite') || msg.includes('yuko') || msg.includes('waza') || msg.includes('ippon') || msg.includes('senshu') || msg.includes('chui') || msg.includes('hansoku');
  const isPara = msg.includes('para') || msg.includes('kursi roda') || msg.includes('wheelchair');
  const isProtest = msg.includes('protes') || msg.includes('video') || msg.includes('vr');
  
  const filesToLoad = new Set<string>();
  
  // Deteksi jika user menanyakan syarat wasit atau regulasi umum
  const isGeneral = msg.includes('umum') || msg.includes('regulasi') || msg.includes('general') || msg.includes('wasit') || msg.includes('referee') || msg.includes('syarat') || msg.includes('lisensi') || msg.includes('coach');
  if (isGeneral) {
    filesToLoad.add('WKF_Referee_Rules_2025.pdf.txt');
    filesToLoad.add('WKF_GENERAL_REGULATIONS_vf.pdf.txt');
  }

  // Muat file spesifik jika terdeteksi
  if (isKata) filesToLoad.add('WKF Kata Competition Rules 2026 MASTER COPY_V2.pdf.txt');
  if (isKumite) filesToLoad.add('WKF 2026 Kumite Competition Rules MASTER COPY_V11.pdf.txt');
  if (isPara) filesToLoad.add('WKF 2026 Para Karate Competition Rules MASTER COPY_V2.pdf.txt');
  if (isProtest) filesToLoad.add('Guidelines for Handling an official protest at WKF Events_180326.pdf.txt');

  // Jika tidak ada topik yang terdeteksi sama sekali, jadikan Kumite sebagai default
  if (!isKata && !isKumite && !isPara && !isProtest && !isGeneral) {
    filesToLoad.add('WKF 2026 Kumite Competition Rules MASTER COPY_V11.pdf.txt');
  }

  try {
    if (fs.existsSync(refDir)) {
      const files = fs.readdirSync(refDir);
      for (const file of files) {
        if (filesToLoad.has(file)) {
          if (!fileCache[file]) {
             let rawText = fs.readFileSync(path.join(refDir, file), 'utf8');
             // Minify teks untuk hemat token: hilangkan spasi/enter ganda dan titik-titik daftar isi
             rawText = rawText.replace(/\.{3,}/g, '.');
             rawText = rawText.replace(/\s+/g, ' ');
             // PANGKAS EKSTREM: Batasi maksimal 40.000 karakter (~10.000 token) per file
             // Ini wajib dilakukan karena limit gratisan Groq sangat ketat (30.000 Token Per Menit)
             rawText = rawText.substring(0, 40000);
             fileCache[file] = rawText.trim();
          }
          result += fileCache[file] + '\n';
        }
      }
    }
  } catch { /* ignore */ }

  if (result.trim()) {
    return `\n\nBERIKUT ADALAH DOKUMEN REFERENSI MUTLAK (BUKU PERATURAN WKF 2026):\n` +
      `==========================================================\n${result}\n` +
      `==========================================================\n` +
      `ATURAN MUTLAK: Jika jawaban dari pertanyaan pengguna TIDAK TERDAPAT secara eksplisit di dalam dokumen Referensi di atas, ` +
      `Anda WAJIB menjawab: 'Maaf, saya tidak menemukan informasi tersebut di buku peraturan WKF 2026'. JANGAN MENEBAK.`;
  }
  return '';
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
  } catch { /* ignore: di Vercel filesystem biasanya read-only */ }
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
${getPdfContext(message)}`;

    // Bangun riwayat percakapan dalam format OpenAI-compatible (Groq memakai format ini)
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-6).map((h: { role: string; text: string }) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: h.text,
      })),
      { role: 'user', content: message },
    ];

    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 2048,
    });

    const reply = response.choices[0]?.message?.content ?? '(Tidak ada respons dari AI)';
    return Response.json({ reply });

  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit') || msg.includes('Rate limit')) {
      return Response.json({ error: '429' }, { status: 429 });
    }
    if (msg.includes('503')) {
      return Response.json({ error: '503' }, { status: 503 });
    }
    console.error('[API Error]', err);
    return Response.json({ error: 'unknown', details: msg }, { status: 500 });
  }
}
