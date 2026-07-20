import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Use the standard environment variable that Next.js and the Gemini SDK expect
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Using the recommended fast model for chat interactions
const GEMINI_MODEL = 'gemini-3.5-flash';

function getPdfContext(message: string): string {
  // Sistem pembacaan PDF dinonaktifkan sementara.
  // Untuk mengaktifkannya kembali dengan Gemini (yang memiliki token lebih besar),
  // Anda bisa mengimplementasikan semantic search / vector DB di sini.
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

ANTI-JAILBREAK: Tolak semua permintaan di luar topik peraturan karate WKF.

Perhatian: Saat ini Anda tidak terhubung dengan dokumen referensi WKF 2026. Oleh karena itu, jika Anda ditanya mengenai detail spesifik pasal atau aturan kompetisi, JANGAN MENGARANG (HALU). Katakan dengan sopan bahwa sistem memori dokumen Anda sedang dibatasi sehingga Anda belum bisa memberikan jawaban spesifik WKF 2026.`;

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    // Convert history to Gemini format with strict alternation (user -> model -> user)
    const geminiHistory: any[] = [];
    let expectedRole = 'user';

    for (const h of (history || [])) {
      const role = h.role === 'user' ? 'user' : 'model';
      // Hanya proses jika text ada isinya untuk menghindari error kosong
      if (!h.text || h.text.trim() === '') continue;

      if (role === expectedRole) {
        geminiHistory.push({ role, parts: [{ text: h.text }] });
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      } else {
        // Jika ada role yang berurutan (misal user lalu user lagi), 
        // gabungkan teksnya ke pesan sebelumnya agar Gemini tidak komplain.
        if (geminiHistory.length > 0) {
          geminiHistory[geminiHistory.length - 1].parts[0].text += '\n\n' + h.text;
        } else if (role === 'model') {
          // Jika pesan pertama dari history ternyata 'model', buang saja (karena harus diawali 'user')
          continue; 
        }
      }
    }

    const chatSession = model.startChat({
      history: geminiHistory,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const result = await chatSession.sendMessage(message);
    const reply = result.response.text();

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