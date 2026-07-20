import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const category: string = body?.category || 'all';

    const dataPath = path.join(process.cwd(), 'src', 'data', 'quiz_bank.json');
    if (!fs.existsSync(dataPath)) {
      throw new Error('Bank soal tidak ditemukan.');
    }

    const content = fs.readFileSync(dataPath, 'utf-8');
    const allQuestions: any[] = JSON.parse(content);

    if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
      throw new Error('Format bank soal tidak valid atau kosong');
    }

    // Filter berdasarkan kategori
    const filtered = category === 'all'
      ? allQuestions
      : allQuestions.filter((q: any) => q.category === category);

    if (filtered.length === 0) {
      throw new Error(`Tidak ada soal untuk kategori: ${category}`);
    }

    // Ambil 10 soal acak (Fisher-Yates shuffle)
    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));

    return Response.json({ questions: selected });
  } catch (err: any) {
    console.error('[Quiz API Error]', err);
    return Response.json({ error: `Gagal memuat soal: ${err.message}` }, { status: 500 });
  }
}
