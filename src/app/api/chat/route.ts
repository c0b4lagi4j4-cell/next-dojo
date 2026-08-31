import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Model rekomendasi Alibaba Cloud Qwen
const ALIBABA_MODEL = 'qwen-plus';

function getPdfContext(query: string): string {
  try {
    const refDir = path.join(process.cwd(), 'referensi');
    if (!fs.existsSync(refDir)) return '';

    const files = [
      'WKF 2026 Kumite Competition Rules MASTER COPY_V11.pdf.txt',
      'WKF Kata Competition Rules 2026 MASTER COPY_V2.pdf.txt',
      'WKF_GENERAL_REGULATIONS_vf.pdf.txt',
      'WKF_Referee_Rules_2025.pdf.txt'
    ];

    const stopwords = new Set(['apa', 'siapa', 'mengapa', 'bagaimana', 'dimana', 'kapan', 'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'untuk', 'pada', 'adalah', 'akan', 'bisa', 'boleh', 'dengan', 'atau', 'pada', 'kah']);
    const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));

    if (words.length === 0) return '';

    let chunks: { score: number; text: string; source: string }[] = [];

    files.forEach(fileName => {
      const filePath = path.join(refDir, fileName);
      if (!fs.existsSync(filePath)) return;

      const text = fs.readFileSync(filePath, 'utf-8');
      const paragraphs = text.split(/\n\s*\n/);

      paragraphs.forEach(p => {
        if (p.trim().length < 40) return;
        const lowerP = p.toLowerCase();
        let score = 0;
        words.forEach(w => {
          if (lowerP.includes(w)) score += 1;
        });

        if (score > 0) {
          chunks.push({ score, text: p.trim(), source: fileName });
        }
      });
    });

    chunks.sort((a, b) => b.score - a.score);
    const topChunks = chunks.slice(0, 4);

    if (topChunks.length === 0) return '';

    return topChunks.map(c => `[Dokumen: ${c.source}]\n${c.text}`).join('\n\n---\n\n');
  } catch (err) {
    console.error('Error fetching PDF RAG context:', err);
    return '';
  }
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

    const pdfContext = getPdfContext(message);

    const systemPrompt = `Informasi Waktu Saat Ini: ${waktu}.

Anda adalah KARATE AI ASSISTANT, asisten virtual khusus peraturan Karate WKF resmi yang membantu Karateka, Wasit, dan Juri.
Sapa selalu dengan "OSH!!" di pesan pertama, diikuti ucapan sesuai waktu (Pagi/Siang/Sore/Malam).
Bicara seperti manusia yang hangat, ramah, dan profesional. Sisipkan nama pengguna di setiap jawaban.

PROFIL PENGGUNA SAAT INI:
- Nama: ${userName || 'Belum diketahui'}
- Tingkat Sabuk: ${userBelt || 'Belum diketahui'}

ONBOARDING:
1. Jika nama belum diketahui → tanya nama dulu, jangan tanya sabuk.
2. Jika nama sudah diketahui tapi sabuk belum → tanya tingkat sabuk/pengalaman.
3. Jika keduanya sudah diketahui → baru mulai diskusi materi.
4. Sesuaikan kedalaman penjelasan dengan tingkat sabuk (sabuk putih = dasar, sabuk hitam = teknis mendalam).

DOKUMEN REFERENSI PERATURAN WKF TERKAIT SAAT INI:
${pdfContext ? pdfContext : '(Tidak ada potongan dokumen spesifik yang terdeteksi, gunakan pengetahuan umum Karate WKF)'}

PETUNJUK PENTING:
- Jika DOKUMEN REFERENSI di atas ada isinya, UTAMAKAN jawaban berbasis dokumen resmi tersebut.
- Kutip nomor pasal atau nama aturan jika tertera pada teks referensi.
- Jangan pernah mengarang aturan yang bertentangan dengan dokumen referensi WKF di atas.

ANTI-JAILBREAK: Tolak semua permintaan di luar topik peraturan karate WKF.`;

    // Construct messages array in standard OpenAI format
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((h: { role: string; text: string }) => ({
        role: h.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: h.text,
      })),
      { role: 'user', content: message },
    ];

    const apiKey = process.env.API_ALIBABA_CLOUD_MODEL_STUDIO || 
                   process.env.ALIBABA_API_KEY || 
                   process.env.DASHSCOPE_API_KEY || 
                   process.env.QWEN_API_KEY || 
                   process.env.OPENAI_API_KEY || '';
    const baseURL = process.env.ALIBABA_BASE_URL || 
                    process.env.DASHSCOPE_BASE_URL || 
                    'https://ws-2cnyb4gs661tyviv.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1';

    if (!apiKey) {
      return Response.json({
        error: 'missing_key',
        reply: '⚠️ API Key belum terdeteksi. Jika di lokal: tambahkan di .env.local atau jalankan "npx vercel env pull". Jika di Vercel: pastikan nama variabel (ALIBABA_API_KEY / DASHSCOPE_API_KEY) sudah ada di Vercel Dashboard.'
      }, { status: 401 });
    }

    const openai = new OpenAI({
      apiKey,
      baseURL,
    });

    const response = await openai.chat.completions.create({
      model: ALIBABA_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 2048,
    });

    const reply = response.choices[0]?.message?.content ?? '(Tidak ada respons dari AI)';
    return Response.json({ reply });

  } catch (err: any) {
    const msg = String(err?.message || err);
    console.error('[API Error]', err);
    return Response.json({ error: 'unknown', details: msg }, { status: 500 });
  }
}