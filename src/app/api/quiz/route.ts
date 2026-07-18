import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Fungsi untuk membaca hanya file bank soal (Questions)
function getQuestionsContext() {
  let result = '';
  const refDir = path.join(process.cwd(), 'referensi');
  
  try {
    if (fs.existsSync(refDir)) {
      const files = fs.readdirSync(refDir);
      // Filter hanya file .txt yang namanya mengandung "question" (case-insensitive)
      for (const file of files) {
        if (file.endsWith('.txt') && file.toLowerCase().includes('question')) {
          const filePath = path.join(refDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          result += `\n\n--- DOKUMEN: ${file} ---\n${content}`;
        }
      }
    }
  } catch (err) {
    console.warn('Gagal membaca folder referensi di Quiz API:', err);
  }

  if (result.trim()) {
    return `\nBERIKUT ADALAH REFERENSI SOAL ASLI DARI BUKU WKF 2026:\n${result}\n`;
  }
  return '';
}

export async function POST(req: Request) {
  try {
    const { belt } = await req.json();

    const pdfContext = getQuestionsContext();
    
    if (!pdfContext) {
      return Response.json({ error: 'Gagal memuat bank soal dari server.' }, { status: 500 });
    }

    const prompt = `Anda adalah penguji ujian wasit/pelatih Karate WKF senior.
Tugas Anda adalah mengekstrak TEPAT 10 soal dari teks referensi Bank Soal resmi WKF di bawah ini.

ATURAN MUTLAK KUIS INI:
1. Anda HANYA boleh mengambil soal dari dokumen yang disediakan di bawah. Jangan membuat soal sendiri.
2. Anda HANYA boleh memilih soal-soal yang aslinya memang bertipe "True/False" (Benar/Salah) di dokumen tersebut.
3. Terjemahkan pertanyaan ke dalam Bahasa Indonesia dengan jelas dan akurat (termasuk istilah Kata/Kumite).
4. Opsi jawaban hanya ada dua: "Benar" atau "Salah".
5. Acak pengambilannya (kombinasi soal tentang Kata, Kumite, dan Coach).
6. Berikan penjelasan (explanation) singkat dalam bahasa Indonesia mengapa pernyataan tersebut Benar/Salah berdasarkan aturan WKF.

PENTING: Kembalikan HANYA JSON array yang valid, tanpa teks awalan/akhiran, tanpa format markdown (\`\`\`json).

Format JSON yang wajib diikuti:
[
  {
    "question": "Pernyataan atau pertanyaan yang sudah diterjemahkan ke bahasa Indonesia?",
    "answer": "Benar", 
    "explanation": "Penjelasan singkat sesuai aturan WKF 2026."
  },
  {
    "question": "Pernyataan lain dalam bahasa Indonesia?",
    "answer": "Salah",
    "explanation": "Penjelasan singkat."
  }
]
(Ingat: Nilai "answer" HARUS string "Benar" atau "Salah", bukan true/false boolean).

${pdfContext}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.3 },
    });

    const raw = response.text ?? '';
    
    // Bersihkan response dari markdown code block jika ada
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const questions = JSON.parse(cleaned);
    
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Format soal tidak valid atau kosong');
    }

    return Response.json({ questions: questions.slice(0, 10) });
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('429') || msg.includes('quota')) return Response.json({ error: '429' }, { status: 429 });
    console.error('[Quiz API Error]', err);
    return Response.json({ error: `Gagal membuat soal: ${msg}` }, { status: 500 });
  }
}
