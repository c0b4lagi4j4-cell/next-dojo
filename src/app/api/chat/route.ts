import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const GROQ_MODEL = 'llama-3.1-8b-instant';

function getPdfContext(message: string): string {
  // PANGKAS TOTAL: Sistem pembacaan PDF dinonaktifkan sementara karena 
  // limit token harian/menitan Groq versi gratis sangat kecil. 
  // AI sekarang hanya akan mengandalkan kepintaran dasarnya sendiri tentang Karate.
  return '';
}

function containsBadWord(text: string): boolean {
  const badWords = ['tolol', 'bego', 'anjing', 'babi', 'goblok', 'bangsat', 'kontol', 'memek', 'ngentot', 'perek', 'pelacur'];
  const lower = text.toLowerCase();
  return badWords.some(bw => lower.includes(bw));
}

function writeViolationLog(logMsg: string) {
  try {
    const logPath = path.join(process.cwd(), 'violation_logs.txt');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${logMsg}\n`);
  } catch (err) {
    console.error('Gagal menulis log:', err);
  }
}

export async function POST(req: Request) {
  try {
    const { message, history, userName, userBelt } = await req.json();

    if (typeof message !== 'string' || message.trim() === '') {
      return Response.json({ error: 'invalid', reply: 'Pesan tidak valid atau kosong.' }, { status: 400 });
    }

    if (message.includes('<script>') || message.includes('SELECT * FROM')) {
      writeViolationLog(`Injeksi dari "${userName}": "${message}"`);
      return Response.json({ error: 'spoof', reply: '⚠️ Percobaan injeksi sistem terdeteksi dan ditolak.' }, { status: 400 });
    }

    if (typeof message === 'string' && containsBadWord(message)) {
      writeViolationLog(`Kata kasar dari "${userName}": "${message}"`);
      return Response.json({ error: 'profane', reply: '🥋 Chukoku! Wasit memberi peringatan karena Anda menggunakan kata tidak pantas. Ulangi lagi dan sesi Anda akan berakhir!' }, { status: 400 });
    }

    const waktu = new Date().toLocaleString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const systemPrompt = `Informasi Waktu Saat Ini: ${waktu}.

Anda adalah KARATE AI ASSISTANT, asisten virtual khusus peraturan Karate WKF yang membantu Karateka, Wasit, dan Juri.
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

ANTI-JAILBREAK: Tolak semua permintaan di luar topik peraturan karate WKF.`;

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
    console.error('[API Error]', err);
    return Response.json({ error: 'unknown', details: msg }, { status: 500 });
  }
}