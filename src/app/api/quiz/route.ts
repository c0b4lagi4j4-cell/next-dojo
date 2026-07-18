import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const dataPath = path.join(process.cwd(), 'src', 'data', 'quiz_bank.json');
    
    if (!fs.existsSync(dataPath)) {
      throw new Error('Bank soal belum digenerate. Silakan jalankan script generate_quiz_bank.ts');
    }

    const content = fs.readFileSync(dataPath, 'utf-8');
    const allQuestions = JSON.parse(content);

    if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
      throw new Error('Format bank soal tidak valid atau kosong');
    }

    // Mengambil 10 soal secara acak (Fisher-Yates shuffle)
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);

    return Response.json({ questions: selected });
  } catch (err: any) {
    console.error('[Quiz API Error]', err);
    return Response.json({ error: `Gagal memuat soal: ${err.message}` }, { status: 500 });
  }
}
