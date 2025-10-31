// FIX: Use GoogleGenAI from @google/genai and import Type for schema
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// FIX: Use GoogleGenAI from @google/genai with the correct initialization object
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY!});

// FIX: Use Type enum for schema definition
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


export const generateAssessmentQuestions = async (textContent: string) => {
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
    // FIX: Use ai.models.generateContent instead of getGenerativeModel
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: assessmentSchema,
        },
    });
    
    // FIX: Access response text via .text property
    const jsonText = response.text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating assessment from Gemini:", error);
    throw new Error("Failed to generate assessment questions.");
  }
};