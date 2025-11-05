---
sidebar_position: 4
---

# Frontend dengan React

Sekarang kita buat frontend untuk aplikasi kuis kita! Kita akan pakai React dengan TypeScript dan Tailwind CSS untuk styling.

## Kenapa React?

- **Component-based**: Code lebih terorganisir dan reusable
- **TypeScript**: Type safety, error lebih sedikit
- **Fast Development**: Hot reload, development server cepat
- **Large Ecosystem**: Banyak library pendukung

## Install Dependencies

```bash
cd frontend
npm install zustand axios lucide-react clsx tailwind-merge
```

**Package yang kita pakai**:
- `zustand`: State management (lebih simple dari Redux)
- `axios`: HTTP client untuk API calls
- `lucide-react`: Icon library yang modern
- `clsx` & `tailwind-merge`: Utility untuk className

## Setup Tailwind CSS

Sudah kita setup di tutorial sebelumnya. Tambahkan warna Dicoding:

```javascript
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00C4CC', // Warna cyan khas Dicoding
          50: '#E0F9FA',
          500: '#00C4CC',
          600: '#00B0B8',
          900: '#006266',
        },
      },
    },
  },
  plugins: [],
}
```

## Struktur Folder Frontend

```
frontend/src/
├── components/       # Komponen UI reusable
│   ├── ui/          # Button, Card, Loader
│   └── layout/      # QuizContainer
├── features/        # Feature-based modules
│   └── quiz/        # Quiz, Question, Results
├── hooks/           # Custom React hooks
│   └── useQuizData.ts
├── services/        # API client
│   └── api.ts
├── store/           # Zustand store
│   └── useQuizStore.ts
├── config/          # Constants
│   └── constants.ts
├── types.ts         # TypeScript interfaces
├── App.tsx          # Main component
└── main.tsx         # Entry point
```

## TypeScript Interfaces

Buat `src/types.ts`:

```typescript
export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: Option[];
  correctOptionId: string;
  explanation: string;
}

export interface Assessment {
  questions: Question[];
}

export interface AssessmentData {
  assessment: Assessment;
  fromCache: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  fontStyle: 'sans' | 'serif' | 'mono';
  layoutWidth: 'standard' | 'fullWidth';
}
```

## API Client

Buat `src/services/api.ts`:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000, // 30 detik (Gemini bisa lama)
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

Simple! `baseURL` pointing ke `/api/v1` yang akan di-rewrite Vercel ke backend.

## Constants

Buat `src/config/constants.ts`:

```typescript
export const QUIZ_CONFIG = {
  TIMER_DURATION_MINUTES: 5,
  DEBOUNCE_MS: 200,
  POLLING_INTERVAL_MS: 500,
  POSTMESSAGE_DELAY_MS: 300,
};

export const API_ENDPOINTS = {
  PREFERENCES: '/preferences',
  ASSESSMENT: '/assessment',
};

export const RESULT_MESSAGES = {
  PERFECT: {
    title: "Luar Biasa! Pemahaman Sempurna!",
    subtitle: "Kamu benar-benar menguasai materi ini."
  },
  EXCELLENT: {
    title: "Kerja Bagus! Kamu di Jalur yang Tepat!",
    subtitle: "Pemahamanmu sudah sangat solid."
  },
  GOOD: {
    title: "Sudah Cukup Baik! Terus Asah Lagi!",
    subtitle: "Dasar-dasarnya sudah kamu pegang."
  },
  NEED_IMPROVEMENT: {
    title: "Jangan Menyerah, Ini Baru Permulaan!",
    subtitle: "Setiap ahli pernah menjadi pemula."
  },
};
```

## Komponen UI Dasar

### Button Component

Buat `src/components/ui/Button.tsx`:

```typescript
import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ 
  className, 
  variant = 'primary', 
  size = 'default', 
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-600',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    ghost: 'bg-transparent hover:bg-slate-100',
  };

  const sizes = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3 rounded-md',
    lg: 'h-11 px-8 rounded-md text-base'
  };

  return (
    <button 
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))} 
      {...props} 
    />
  );
};

export default Button;
```

### Card Component

Buat `src/components/ui/Card.tsx`:

```typescript
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={twMerge(
        'bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
```

### Loader Component

Buat `src/components/ui/Loader.tsx`:

```typescript
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
};

export default Loader;
```

## Penjelasan Komponen

### 1. Button Component

- **Props Extends HTMLButtonElement**: Kita bisa pakai semua props HTML button (`onClick`, `disabled`, dll)
- **Variant & Size**: Bisa customize tampilan button
- **twMerge & clsx**: Combine className dengan smart (no duplicates)

### 2. Card Component

- **Dark Mode Ready**: Pake `dark:` prefix dari Tailwind
- **Flexible**: Bisa override className dari parent

### 3. Loader Component

- **Simple Spinner**: Pakai Tailwind animation
- **Warna Primary**: Sesuai brand Dicoding

## Main App Structure

Buat `src/App.tsx`:

```typescript
import React, { useState } from 'react';

const App: React.FC = () => {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const tutorialId = urlParams.get('tutorial_id') || urlParams.get('tutorial');
  const userId = urlParams.get('user_id') || urlParams.get('user');
  
  // State
  const [quizStarted, setQuizStarted] = useState(false);

  // Check if embedded in iframe
  const isEmbedded = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }, []);

  return (
    <main className="bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-4xl mx-auto p-4">
        <h1>LearnCheck!</h1>
        {/* Content will go here */}
      </div>
    </main>
  );
};

export default App;
```

## URL Parameters

Kita support 2 format parameter:
1. `?tutorial_id=123&user_id=456` (format lengkap)
2. `?tutorial=123&user=456` (format pendek)

Ini biar flexible kalau Dicoding mau pake format yang mana aja.

## Iframe Detection

```typescript
window.self !== window.top
```

Ini cara detect apakah app kita jalan di dalam iframe atau standalone. Berguna untuk:
- Adjust layout (no padding berlebih di iframe)
- Security (validate message dari parent window)

## Dark Mode Support

```typescript
<div className="bg-slate-50 dark:bg-slate-900">
```

Tailwind otomatis handle dark mode kalau parent punya class `dark`. Nanti kita akan sync ini dengan preference user dari Dicoding.

## Testing

Jalankan development server:

```bash
npm run dev
```

Buka browser: `http://localhost:5173?tutorial_id=123&user_id=456`

Kamu harus lihat halaman kosong tapi sudah terstruktur!

## Kesimpulan

Kita sudah punya:
- ✅ Struktur folder yang terorganisir
- ✅ TypeScript interfaces untuk type safety
- ✅ API client dengan axios
- ✅ UI components (Button, Card, Loader)
- ✅ Dark mode support
- ✅ URL parameter parsing
- ✅ Iframe detection

Di tutorial berikutnya, kita akan buat state management dengan Zustand!

## Next Steps

Lanjut ke [State Management dengan Zustand](./05-state.md) →
