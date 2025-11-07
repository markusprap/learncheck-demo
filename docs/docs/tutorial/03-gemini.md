---
sidebar_position: 3
---

# Integrasi Gemini AI

Di tutorial ini, kita akan mengintegrasikan Google Gemini AI untuk generate pertanyaan kuis secara otomatis dari konten tutorial.

## 🎯 What We're Building

Service yang bisa:
1. **Input**: Plain text dari tutorial (sudah di-parse dari HTML)
2. **Process**: Kirim ke Gemini AI dengan prompt yang terstruktur
3. **Output**: 3 pertanyaan multiple choice dalam Bahasa Indonesia (format JSON)

## 🔗 Where It Fits in the Flow

```
assessment.service.ts
    ↓
1. Fetch tutorial HTML dari dicoding.service
2. Parse HTML → plain text (htmlParser)
3. Send text → gemini.service.ts ← WE ARE HERE!
    ↓
    Gemini AI generates 3 questions
    ↓
4. Return Assessment JSON
    ↓
5. Combine with user preferences
    ↓
6. Send to frontend
```

**Why in assessment.service flow?**
- Gemini needs **clean text input** (not HTML)
- Gemini generates **only questions** (not preferences)
- Assessment service **orchestrates** all data sources

## Apa itu Gemini AI?

**Gemini** adalah model AI terbaru dari Google yang bisa:
- 🧠 Memahami dan menganalisis teks panjang
- ✍️ Generate konten terstruktur (JSON)
- 🎯 Membuat pertanyaan yang relevan dengan materi
- 🇮🇩 Menulis dalam Bahasa Indonesia yang natural

## Kenapa Gemini?

### 🤔 Why Not Just Write Questions Manually?

**Problem**: Manual question creation doesn't scale
```
1 tutorial = 30 minutes to write 3 questions
100 tutorials = 3,000 minutes = 50 hours!
```

**Solution**: AI generates questions instantly
```
1 tutorial = ~15 seconds with Gemini
100 tutorials = 25 minutes total
```

### 🤔 Why Gemini Specifically?

**Comparison with alternatives**:

| Feature | Gemini 2.5 Flash | GPT-4 | Claude |
|---------|------------------|-------|--------|
| **Speed** | ~10-15s | ~20-30s | ~15-20s |
| **Structured Output** | ✅ Native (Type enum) | ✅ (json_schema) | ✅ (tool use) |
| **Indonesian Support** | ✅ Excellent | ✅ Good | ✅ Good |
| **Free Tier** | ✅ 60 req/min | ❌ No free tier | ❌ No free tier |
| **Cost (per 1M tokens)** | $0.075 | $10 | $3 |

**Why we chose Gemini**:
1. **Fast**: Response ~10-15 detik (lebih cepat dari GPT-4)
2. **Structured Output**: Bisa generate JSON langsung dengan schema validation (Type enum)
3. **Affordable**: Free tier 60 requests/minute (cukup untuk development)
4. **Multilingual**: Bagus untuk Bahasa Indonesia
5. **Google AI Studio**: Easy testing interface sebelum coding

## Dapatkan API Key

### Step 1: Buka Google AI Studio

Pergi ke [https://ai.google.dev/](https://ai.google.dev/)

### Step 2: Login dengan Akun Google

Gunakan akun Google pribadi atau workspace kamu.

### Step 3: Get API Key

Klik tombol **"Get API Key"** → **"Create API key"**

API key format: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

### Step 4: Simpan di .env

Buat file `backend/.env`:

```bash
cd backend
touch .env
```

Isi dengan API key kamu:

```env
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
PORT=4000
```

⚠️ **JANGAN COMMIT .env KE GIT!** File ini sudah ada di `.gitignore`.

## Install Package

```bash
cd backend
npm install @google/genai@1.28.0
```

**CRITICAL**: Pakai versi `1.28.0` yang exact! Versi ini yang stabil dan compatible dengan structured output.

❌ **JANGAN pakai**: `@google/generative-ai` (package lama)
✅ **GUNAKAN**: `@google/genai` (package baru)

## Buat Gemini Service

### 🤔 Why Separate Service File?

**Problem**: Gemini logic scattered everywhere
```typescript
// ❌ BAD: Gemini code in controller
app.get('/assessment', async (req, res) => {
  const ai = new GoogleGenAI({apiKey: '...'});
  const response = await ai.models.generateContent({...});
  // ... lots of Gemini-specific code
});

// ❌ BAD: Gemini code in assessment.service
export const fetchAssessmentData = async () => {
  const ai = new GoogleGenAI({apiKey: '...'});
  // ... mixing Gemini with business logic
};
```

**Solution**: Dedicated gemini.service.ts
```typescript
// ✅ GOOD: Single responsibility
// gemini.service.ts - ONLY Gemini AI concerns
export const generateAssessmentQuestions = async (text: string) => {
  // All Gemini logic here
};

// assessment.service.ts - Business logic
export const fetchAssessmentData = async () => {
  const text = parseHTML(html);
  const questions = await generateAssessmentQuestions(text); // Clean!
};
```

**Benefits**:
- 🎯 **Single Responsibility**: File only cares about Gemini
- 🔄 **Reusable**: Bisa generate questions untuk use case lain
- 🧪 **Testable**: Easy to mock Gemini responses
- 🔧 **Maintainable**: Ganti ke AI lain? Cuma edit 1 file

### Service Structure

```
gemini.service.ts contains:
├─ API key validation (module load time)
├─ GoogleGenAI initialization
├─ assessmentSchema definition (Type enum)
├─ generateAssessmentQuestions() function
└─ Error handling
```

Sekarang kita buat service untuk handle AI generation. Ini file paling penting di backend!

Buat file `backend/src/services/gemini.service.ts`:

```typescript
import { GoogleGenAI, Type } from '@google/genai';
import { API_CONFIG, ERROR_MESSAGES } from '../config/constants';
import type { Assessment } from '../types';

// Validate API key exists
if (!process.env.GEMINI_API_KEY) {
  console.error('[Gemini] CRITICAL: GEMINI_API_KEY not found in environment variables');
  throw new Error('GEMINI_API_KEY is required');
}

// Initialize with API key explicitly
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
});

console.log('[Gemini] SDK initialized successfully');

const assessmentSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: "Sebuah array berisi 3 pertanyaan pilihan ganda.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: {
                        type: Type.STRING,
                        description: "ID unik untuk pertanyaan, contoh: 'q1', 'q2'."
                    },
                    questionText: {
                        type: Type.STRING,
                        description: "Teks pertanyaan."
                    },
                    options: {
                        type: Type.ARRAY,
                        description: "Sebuah array berisi 4 pilihan jawaban.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: {
                                    type: Type.STRING,
                                    description: "ID unik untuk pilihan, contoh: 'opt1', 'opt2'."
                                },
                                text: {
                                    type: Type.STRING,
                                    description: "Teks jawaban."
                                }
                            },
                            required: ["id", "text"]
                        }
                    },
                    correctOptionId: {
                        type: Type.STRING,
                        description: "ID dari pilihan jawaban yang benar dari array 'options'."
                    },
                    explanation: {
                        type: Type.STRING,
                        description: "Penjelasan netral yang fokus pada konsep, menjelaskan mengapa jawaban benar dan yang lain salah. Harus diakhiri dengan 'Hint:' diikuti petunjuk."
                    }
                },
                required: ["id", "questionText", "options", "correctOptionId", "explanation"]
            }
        }
    },
    required: ["questions"]
};

/**
 * Generate assessment questions using Gemini AI
 * @param textContent - Clean text content from tutorial
 * @returns Assessment object with generated questions
 * @throws Error if generation fails or response is empty
 */
export const generateAssessmentQuestions = async (textContent: string): Promise<Assessment> => {
  const prompt = `
    Berdasarkan konten berikut, buatkan 3 pertanyaan pilihan ganda dalam Bahasa Indonesia untuk menguji pemahaman.
    Setiap pertanyaan harus memiliki 4 pilihan jawaban.
    Untuk setiap pertanyaan, sertakan teks pertanyaan, 4 pilihan jawaban (masing-masing dengan ID unik seperti 'opt1', 'opt2', dst.), ID dari pilihan yang benar, dan sebuah penjelasan.
    
    Penting: Ikuti aturan ini saat membuat penjelasan:
    - Mulai penjelasan secara langsung tanpa kalimat pembuka yang bersifat menilai seperti "Tepat sekali!" atau "Kurang tepat.". Penjelasan harus fokus pada konsepnya.
    - Jelaskan mengapa jawaban yang benar itu benar dan mengapa pilihan-pilihan lain salah, merujuk ke konsep inti dari materi.
    - Jaga agar penjelasan singkat (maksimal 3 kalimat).
    - Setelah penjelasan utama, tambahkan "Hint:" diikuti dengan satu kalimat rekomendasi untuk mempelajari kembali topik spesifik yang relevan dengan pertanyaan ini. Contoh: "Untuk lebih paham, coba pelajari lagi materi tentang state di React."
    - Tulis dalam Bahasa Indonesia yang kasual namun profesional.
    
    Gunakan gaya bahasa yang santai dan mudah dimengerti untuk seluruh soal.

    Konten:
    ---
    ${textContent}
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: API_CONFIG.GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: assessmentSchema,
      },
    });
    
    const jsonText = response.text;
    if (!jsonText) {
      throw new Error(ERROR_MESSAGES.EMPTY_GEMINI_RESPONSE);
    }
    
    return JSON.parse(jsonText) as Assessment;
  } catch (error) {
    console.error("[Gemini] Error generating assessment:", error);
    throw new Error(ERROR_MESSAGES.GEMINI_GENERATION_FAILED);
  }
};
```

## Penjelasan Kode (Step by Step)

### 1. Import Dependencies

```typescript
import { GoogleGenAI, Type } from '@google/genai';
```

- `GoogleGenAI`: Main class untuk initialize AI client
- `Type`: Enum untuk define schema (Type.OBJECT, Type.ARRAY, Type.STRING)

### 2. API Key Validation

```typescript
if (!process.env.GEMINI_API_KEY) {
  console.error('[Gemini] CRITICAL: GEMINI_API_KEY not found');
  throw new Error('GEMINI_API_KEY is required');
}
```

**Kenapa di sini?** 

Karena code ini **di-run saat module loading** (bukan di function). Jika API key tidak ada, aplikasi langsung crash dengan error message yang jelas.

### 3. Initialize AI Client

```typescript
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
});

console.log('[Gemini] SDK initialized successfully');
```

Console.log ini muncul saat backend start. Jika kamu lihat log ini, berarti API key berhasil loaded!

### 4. Schema Definition (CRITICAL!)

```typescript
const assessmentSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    questionText: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: {...} },
                    correctOptionId: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                }
            }
        }
    }
};
```

**Kenapa butuh schema?**

Tanpa schema, Gemini bisa return format apapun:
```json
// ❌ Bisa jadi kayak gini (gak konsisten)
{
  "soal": [...],  // key name beda
  "pertanyaan": [...],  // format gak pasti
}
```

Dengan schema, response **PASTI** format yang kita mau:
```json
// ✅ Selalu format ini
{
  "questions": [
    {
      "id": "q1",
      "questionText": "...",
      "options": [...],
      "correctOptionId": "opt1",
      "explanation": "..."
    }
  ]
}
```

### 5. Prompt Engineering (Seni Bicara ke AI)

```typescript
const prompt = `
    Berdasarkan konten berikut, buatkan 3 pertanyaan pilihan ganda dalam Bahasa Indonesia...
    
    Penting: Ikuti aturan ini saat membuat penjelasan:
    - Mulai penjelasan secara langsung tanpa kalimat pembuka...
    - Jelaskan mengapa jawaban yang benar itu benar...
    - Jaga agar penjelasan singkat (maksimal 3 kalimat).
    - Setelah penjelasan utama, tambahkan "Hint:"...
`;
```

**Kenapa prompt ini panjang?**

AI itu kayak junior developer—butuh instruksi yang **sangat spesifik**:

❌ **Prompt jelek**:
```
Buatkan 3 soal tentang materi ini.
```
Result: Soal gak relevan, penjelasan ambiguous, format gak konsisten.

✅ **Prompt bagus** (yang kita pakai):
```
- Buatkan 3 pertanyaan pilihan ganda dalam Bahasa Indonesia
- Setiap pertanyaan 4 pilihan jawaban
- Penjelasan harus fokus pada konsep (bukan "Tepat sekali!")
- Penjelasan maksimal 3 kalimat
- Akhiri dengan "Hint:" diikuti rekomendasi belajar
```
Result: Soal relevan, penjelasan jelas, format konsisten!

### 6. Generate Content with Schema

```typescript
const response = await ai.models.generateContent({
  model: API_CONFIG.GEMINI_MODEL,  // 'gemini-2.5-flash'
  contents: prompt,
  config: {
    responseMimeType: "application/json",  // Force JSON output
    responseSchema: assessmentSchema,      // Validate structure
  },
});
```

**Parameters Explained**:

- `model`: Model name (kita pakai `gemini-2.5-flash` yang balance speed vs quality)
- `contents`: Prompt yang kita kirim
- `responseMimeType: "application/json"`: Paksa Gemini return JSON (bukan text biasa)
- `responseSchema`: Schema validation (struktur HARUS sesuai schema kita)

### 7. Parse and Return

```typescript
const jsonText = response.text;
if (!jsonText) {
  throw new Error(ERROR_MESSAGES.EMPTY_GEMINI_RESPONSE);
}

return JSON.parse(jsonText) as Assessment;
```

Response dari Gemini itu string JSON. Kita parse jadi object TypeScript.

## Update Constants

Pastikan `backend/src/config/constants.ts` punya model name:

```typescript
export const API_CONFIG = {
  DICODING_BASE_URL: 'https://learncheck-dicoding-mock-666748076441.europe-west1.run.app/api',
  GEMINI_MODEL: 'gemini-2.5-flash',  // ← Pastikan ini ada!
  REQUEST_TIMEOUT: 30000,
} as const;
```

## Test Gemini Integration

### Test 1: Backend Start (Check API Key Loading)

```bash
cd backend
npm run dev
```

Expected output:
```
[Gemini] SDK initialized successfully  ← Ini harus muncul!
🚀 Backend server running on http://localhost:4000
```

❌ **Jika error**: "GEMINI_API_KEY not found"
→ Check `.env` file ada dan isinya benar

### Test 2: Generate Quiz

```bash
curl "http://localhost:4000/api/v1/assessment?tutorial_id=35363&user_id=1"
```

**Process flow**:
1. Backend fetch tutorial HTML dari Dicoding mock API (~1s)
2. Parse HTML ke clean text (~0.1s)
3. Send text ke Gemini AI (~12-15s) ← **This takes time!**
4. Parse response JSON (~0.1s)
5. Return ke client

Expected response:
```json
{
  "assessment": {
    "questions": [
      {
        "id": "q1",
        "questionText": "Apa fungsi dari useState hook di React?",
        "options": [
          { "id": "opt1", "text": "Mengelola state komponen" },
          { "id": "opt2", "text": "Melakukan fetch data" },
          { "id": "opt3", "text": "Styling komponen" },
          { "id": "opt4", "text": "Routing aplikasi" }
        ],
        "correctOptionId": "opt1",
        "explanation": "useState adalah hook untuk mengelola state di functional component. Hook ini mengembalikan array dengan nilai state dan setter function. Options lain tidak sesuai dengan fungsi useState. Hint: Pelajari lagi materi tentang React Hooks dan state management."
      },
      {
        "id": "q2",
        "questionText": "...",
        "options": [...],
        "correctOptionId": "...",
        "explanation": "..."
      },
      {
        "id": "q3",
        "questionText": "...",
        "options": [...],
        "correctOptionId": "...",
        "explanation": "..."
      }
    ]
  },
  "userPreferences": {
    "theme": "dark",
    "fontSize": "medium",
    "fontStyle": "default",
    "layoutWidth": "standard"
  },
  "fromCache": false
}
```

## Format Explanation & Hint

Perhatikan format `explanation`:

```typescript
"explanation": "useState adalah hook untuk mengelola state... Hint: Pelajari lagi materi tentang React Hooks."
```

**Kenapa split dengan "Hint:"?**

Frontend akan split string ini:
```typescript
const parts = explanation.split('Hint:');
const mainExplanation = parts[0];  // "useState adalah hook..."
const hintText = parts[1];          // "Pelajari lagi materi..."
```

Terus display dengan styling berbeda:
- Main explanation: Text biasa
- Hint: Dengan icon 💡 dan background khusus

## Common Issues & Solutions

### Issue 1: "Rate limit exceeded"

**Cause**: Terlalu banyak request ke Gemini (free tier: 60 req/min)

**Solution**: 
- Add delay antar request
- Implement caching (optional)
- Upgrade ke paid plan

### Issue 2: Empty response dari Gemini

**Cause**: Prompt terlalu panjang atau content tidak valid

**Solution**:
```typescript
// Add content length check
if (textContent.length > 10000) {
  textContent = textContent.substring(0, 10000);
}
```

### Issue 3: Response format gak sesuai schema

**Cause**: Schema definition salah atau Gemini error

**Solution**: Check logs:
```typescript
console.log('[Gemini] Raw response:', response.text);
```

## Performance Tips

### 1. Content Length

Jangan kirim HTML mentah! Parse dulu ke clean text:

```typescript
// ❌ Bad (kirim HTML)
const htmlContent = await getTutorialContent(tutorialId);
await generateAssessmentQuestions(htmlContent);  // 50KB HTML!

// ✅ Good (parse dulu)
const htmlContent = await getTutorialContent(tutorialId);
const textContent = parseHtmlContent(htmlContent);  // 5KB text
await generateAssessmentQuestions(textContent);  // Faster!
```

### 2. Prompt Optimization

Makin spesifik prompt, makin cepat response:

```typescript
// ❌ Slow (ambiguous)
"Buatkan soal tentang materi ini"

// ✅ Fast (specific)
"Buatkan 3 pertanyaan pilihan ganda dalam Bahasa Indonesia..."
```

### 3. Parallel Processing (Already implemented!)

```typescript
// ✅ Fetch content dan preferences parallel
const [tutorialHtml, userPreferences] = await Promise.all([
  getTutorialContent(tutorialId),
  getUserPreferences(userId),
]);
```

## Architecture Flow

```
Client Request
    ↓
Controller (assessment.controller.ts)
    ↓
Service (assessment.service.ts)
    ↓
Dicoding Service → Fetch HTML
    ↓
HTML Parser → Clean text
    ↓
Gemini Service → Generate questions  ← WE ARE HERE!
    ↓
Return JSON to client
```

## Kesimpulan

Gemini AI integration kita sekarang punya:
- ✅ API key validation (crash early if missing)
- ✅ Structured output dengan schema (consistent format)
- ✅ Indonesian language support (natural Bahasa Indonesia)
- ✅ Hint format (split by "Hint:" for UI display)
- ✅ Error handling (proper error messages)
- ✅ Type safety (TypeScript return type)

Response time: **~12-15 detik** untuk generate 3 questions. Acceptable untuk learning tool!

## Next Steps

Backend udah complete! Sekarang kita build frontend React untuk display quiz.

Lanjut ke [Frontend dengan React & Vite](./04-frontend.md) →
