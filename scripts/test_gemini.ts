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
  console.log('Menguji API Key:', process.env.GEMINI_API_KEY);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Test connection',
    });
    console.log('Respon:', response.text);
  } catch (err: any) {
    console.error('Error detail:', err);
  }
}

main();
