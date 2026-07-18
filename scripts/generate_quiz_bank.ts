import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

try {
  const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
} catch (e) {
  console.log('Tidak dapat membaca .env.local');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function main() {
  console.log('Memulai ekstraksi soal dari referensi PDF...');
  let pdfContext = '';
  const refDir = path.join(process.cwd(), 'referensi');

  if (fs.existsSync(refDir)) {
    const files = fs.readdirSync(refDir);
    for (const file of files) {
      if (file.endsWith('.txt') && file.toLowerCase().includes('question')) {
        const filePath = path.join(refDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        pdfContext += `\n\n--- DOKUMEN: ${file} ---\n${content}`;
        console.log(`- Membaca: ${file} (${content.length} karakter)`);
      }
    }
  }

  if (!pdfContext.trim()) {
    console.error('Gagal memuat dokumen soal referensi.');
    return;
  }

  const prompt = `Anda adalah penguji ujian wasit/pelatih Karate WKF senior.
Tugas Anda adalah mengekstrak SEMUA soal bertipe "True/False" (Benar/Salah) dari teks referensi Bank Soal resmi WKF di bawah ini. Hasilkan minimal 50 soal, dan sebaiknya 100 soal jika tersedia.

ATURAN MUTLAK:
1. HANYA ambil soal yang aslinya memang bertipe "True/False" (Benar/Salah). Abaikan soal pilihan ganda (A, B, C, D).
2. Terjemahkan pertanyaan ke dalam Bahasa Indonesia dengan jelas dan akurat (termasuk istilah Kata/Kumite).
3. Opsi jawaban hanya ada dua: "Benar" atau "Salah".
4. Berikan penjelasan (explanation) singkat dalam bahasa Indonesia mengapa pernyataan tersebut Benar/Salah berdasarkan aturan WKF.

PENTING: Kembalikan HANYA JSON array yang valid tanpa backticks markdown.
[
  {
    "question": "Pernyataan atau pertanyaan yang sudah diterjemahkan?",
    "answer": "Benar", 
    "explanation": "Penjelasan singkat."
  }
]

${pdfContext}`;

  console.log('Meminta Gemini untuk mengekstrak (mungkin butuh beberapa detik)...');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.1 },
    });

    const raw = response.text ?? '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const questions = JSON.parse(cleaned);

    if (!Array.isArray(questions)) throw new Error('Format bukan array');

    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const targetFile = path.join(dataDir, 'quiz_bank.json');
    let existingQuestions: any[] = [];
    if (fs.existsSync(targetFile)) {
      try {
        existingQuestions = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
      } catch (e) {
        console.log('File ada tapi tidak valid, mulai dari array kosong.');
      }
    }

    const merged = [...existingQuestions, ...questions];
    
    // Hapus duplikat berdasarkan pertanyaan
    const unique = Array.from(new Map(merged.map(item => [item.question, item])).values());

    fs.writeFileSync(
      targetFile,
      JSON.stringify(unique, null, 2)
    );

    console.log(`✅ Berhasil menambahkan ${questions.length} soal baru. Total sekarang: ${unique.length} soal di src/data/quiz_bank.json!`);
  } catch (err: any) {
    console.error('❌ Gagal dengan 2.5-pro:', err.message);
    console.log('Mencoba lagi dengan gemini-2.0-flash...');
    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.1 },
    });
    const raw = response.text ?? '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const questions = JSON.parse(cleaned);
    const dataDir = path.join(process.cwd(), 'src', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        
    const targetFile = path.join(dataDir, 'quiz_bank.json');
    let existingQuestions: any[] = [];
    if (fs.existsSync(targetFile)) {
      try { existingQuestions = JSON.parse(fs.readFileSync(targetFile, 'utf-8')); } catch (e) {}
    }
        
    const merged = [...existingQuestions, ...questions];
    const unique = Array.from(new Map(merged.map(item => [item.question, item])).values());

    fs.writeFileSync(targetFile, JSON.stringify(unique, null, 2));
    console.log(`✅ Berhasil menambahkan ${questions.length} soal baru via flash. Total sekarang: ${unique.length} soal di src/data/quiz_bank.json!`);
  }
}

main();
