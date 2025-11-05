---
sidebar_position: 3
---

# Integrasi Gemini AI

Di tutorial ini, kita akan mengintegrasikan Google Gemini AI untuk generate pertanyaan kuis secara otomatis dari konten tutorial.

## Apa itu Gemini AI?

Gemini adalah model AI terbaru dari Google yang bisa memahami teks dan generate konten. Kita akan pakai Gemini untuk:
1. Baca konten tutorial dari Dicoding
2. Analisis materi yang ada
3. Generate 3 pertanyaan pilihan ganda yang relevan
4. Buat penjelasan untuk setiap jawaban

## Dapatkan API Key

1. Buka [Google AI Studio](https://ai.google.dev/)
2. Login dengan akun Google
3. Klik "Get API Key"
4. Copy API key yang didapat
5. Simpan di file `.env`:

```env
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Install Package

```bash
cd backend
npm install @google/genai
```

**Catatan Penting**: Kita pakai `@google/genai` bukan `@google/generative-ai`. Package ini versi terbaru dengan API yang lebih simple.

## Buat Gemini Service

Buat file `backend/src/services/gemini.service.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const generateAssessmentQuestions = async (textContent: string) => {
  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is required');
  }

  const model = 'gemini-2.0-flash-exp';
  
  const prompt = `Kamu adalah asisten AI yang ahli dalam membuat soal kuis...`;
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                  options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        text: { type: 'string' }
                      }
                    }
                  },
                  correctOptionId: { type: 'string' },
                  explanation: { type: 'string' }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    return JSON.parse(text);
  } catch (error: any) {
    console.error('Gemini API error:', error);
    throw new Error(`Failed to generate questions: ${error.message}`);
  }
};
```

## Penjelasan Kode

### 1. Inisialisasi AI Client

```typescript
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});
```

Kita buat instance GoogleGenAI dengan API key dari environment variable.

### 2. Model yang Digunakan

```typescript
const model = 'gemini-2.0-flash-exp';
```

Kita pakai Gemini 2.0 Flash Experimental karena:
- Lebih cepat (response dalam 1-2 detik)
- Gratis untuk development
- Sudah cukup untuk generate pertanyaan kuis

### 3. Structured Output

```typescript
responseMimeType: 'application/json',
responseSchema: { ... }
```

Ini fitur penting! Kita define schema JSON yang kita mau, dan Gemini akan SELALU return response sesuai format yang kita tentukan. Tidak perlu parsing yang ribet.

### 4. Prompt Engineering

Prompt yang bagus itu penting! Kita beri instruksi spesifik:
- Buat 3 pertanyaan
- Bahasa Indonesia
- Format pilihan ganda (A, B, C, D)
- Kasih penjelasan lengkap
- Tambahkan hint kalau perlu

## Test Gemini Service

Buat file test `backend/src/test-gemini.ts`:

```typescript
import dotenv from 'dotenv';
import { generateAssessmentQuestions } from './services/gemini.service';

dotenv.config();

const testContent = `
Convolutional Neural Network (CNN) adalah jenis jaringan saraf tiruan yang dirancang khusus untuk memproses data yang memiliki pola grid, seperti gambar. CNN menggunakan operasi konvolusi untuk mengekstrak fitur dari gambar secara hierarkis.
`;

generateAssessmentQuestions(testContent)
  .then(result => {
    console.log('Generated Questions:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

Jalankan test:

```bash
npx ts-node src/test-gemini.ts
```

Kalau berhasil, kamu akan lihat 3 pertanyaan tentang CNN!

## Error Handling

Gemini API bisa gagal karena:
1. **API Key Invalid**: Cek lagi key nya
2. **Rate Limit**: Terlalu banyak request (max 60/menit untuk free tier)
3. **Content Too Long**: Gemini 2.0 Flash bisa handle max 1M tokens
4. **Network Error**: Koneksi internet bermasalah

Kita handle dengan try-catch dan kasih error message yang jelas.

## Tips & Tricks

### 1. Optimasi Prompt

Semakin spesifik prompt, semakin bagus hasilnya:
- "Buat 3 pertanyaan tentang..." ✅
- "Buat pertanyaan..." ❌

### 2. Temperature Setting

```typescript
config: {
  temperature: 0.7, // 0-1, makin tinggi makin creative
}
```

- 0.3-0.5: Konsisten, cocok untuk kuis
- 0.7-0.9: Variatif, cocok untuk konten kreatif

### 3. Max Tokens

```typescript
config: {
  maxOutputTokens: 2048,
}
```

Batasi output supaya tidak terlalu panjang dan hemat cost.

## Kesimpulan

Sekarang kita punya service yang bisa:
- Generate pertanyaan kuis otomatis
- Format output yang konsisten (JSON schema)
- Error handling yang proper

Di tutorial berikutnya, kita akan integrasikan ini dengan Dicoding API untuk scrape konten tutorial!

## Next Steps

Lanjut ke [Frontend dengan React](./04-frontend.md) →
