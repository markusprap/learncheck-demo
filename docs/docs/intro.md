---
sidebar_position: 1
---

# Pengenalan LearnCheck!

Selamat datang di dokumentasi **LearnCheck!** - aplikasi generator kuis AI untuk Dicoding Classroom.

## Apa itu LearnCheck!?

LearnCheck! adalah aplikasi web yang secara otomatis menghasilkan pertanyaan kuis berdasarkan konten tutorial menggunakan Google Gemini AI. Aplikasi ini membantu siswa menguji pemahaman mereka segera setelah belajar.

## Fitur Utama

- **AI-Generated Questions**: Generate 3 pertanyaan pilihan ganda per tutorial menggunakan Gemini 2.5 Flash
- **Redis Caching**: Loading 12x lebih cepat dengan Upstash Redis (16 detik → 1.3 detik)
- **Real-Time Preferences**: Sinkronisasi tema, ukuran font, dan gaya font secara real-time (500ms latency)
- **Progress Tracking**: Penyimpanan state kuis berbasis LocalStorage dengan isolasi per user/per tutorial
- **Rate Limiting**: Pembatasan 5 generate kuis per menit per user
- **Responsive Design**: Dioptimalkan untuk desktop dan mobile
- **Dark Mode**: Mengikuti preferensi user dari Dicoding

## Arsitektur

```
learncheck-demo/
├── backend/              # Express.js API
│   └── src/
│       ├── config/       # Konstanta dan konfigurasi
│       ├── types/        # TypeScript interfaces
│       ├── controllers/  # Request handlers
│       ├── routes/       # API routes
│       ├── services/     # Business logic
│       └── utils/        # Helper functions
│
├── frontend/             # React + Vite SPA
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── features/     # Feature modules
│       ├── hooks/        # Custom React hooks
│       ├── services/     # API client
│       ├── store/        # Zustand state management
│       └── config/       # Frontend constants
│
└── docs/                 # Docusaurus documentation
```

## Teknologi

### Frontend
- React 18 + TypeScript
- Vite 6 (build tool)
- Zustand (state management)
- Tailwind CSS (styling)
- Lucide React (icons)

### Backend
- Node.js + Express
- TypeScript
- Google Gemini AI (@google/genai)
- Axios (HTTP client)
- Cheerio (HTML parsing)
- IORedis (Redis client)

### Infrastructure
- Vercel (hosting)
- Upstash Redis (managed Redis)
- Dicoding Mock API (content source)

## Mulai Cepat

```bash
# Clone repository
git clone https://github.com/markusprap/learncheck-demo.git
cd learncheck-demo

# Setup backend
cd backend
npm install
cp .env.example .env
# Tambahkan GEMINI_API_KEY dan REDIS_URL ke .env
npm run dev

# Setup frontend (terminal baru)
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173?tutorial_id=35363&user_id=1 untuk testing.

## Tutorial

Ikuti tutorial step-by-step untuk membangun aplikasi ini dari awal:

1. [Setup Project](./tutorial/01-setup.md)
2. [Backend API dengan Express](./tutorial/02-backend.md)
3. [Integrasi Gemini AI](./tutorial/03-gemini.md)
4. [Frontend dengan React](./tutorial/04-frontend.md)
5. [State Management dengan Zustand](./tutorial/05-state.md)
6. [Real-Time Preferences](./tutorial/06-realtime.md)
7. [Redis Caching](./tutorial/07-redis.md)
8. [Deploy ke Vercel](./tutorial/08-deployment.md)

## Kontribusi

Kontribusi selalu diterima! Silakan buat pull request atau issue di [GitHub repository](https://github.com/markusprap/learncheck-demo).

## Lisensi

MIT License - silakan gunakan project ini sebagai referensi!
