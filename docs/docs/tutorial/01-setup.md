---
sidebar_position: 1
---

# Setup Project

Tutorial pertama ini akan memandu kamu untuk setup project LearnCheck! dari awal.

## Prasyarat

Pastikan kamu sudah install:
- Node.js 18 atau lebih baru
- npm atau yarn
- Git
- Code editor (VSCode recommended)

## Struktur Project

Kita akan membuat monorepo dengan struktur:
```
learncheck-demo/
├── backend/      # Express.js API
├── frontend/     # React app
├── docs/         # Docusaurus (opsional)
└── vercel.json   # Deployment config
```

## Langkah 1: Inisialisasi Project

Buat folder root project:

```bash
mkdir learncheck-demo
cd learncheck-demo
git init
```

## Langkah 2: Setup Backend

Buat folder backend dan inisialisasi npm:

```bash
mkdir backend
cd backend
npm init -y
```

Install dependencies backend:

```bash
npm install express cors dotenv axios cheerio @google/genai@1.28.0
npm install -D typescript @types/node @types/express @types/cors ts-node-dev
```

**Penting**: Gunakan `@google/genai` versi 1.28.0 (BUKAN `@google/generative-ai`). Package ini adalah SDK resmi terbaru dari Google dengan API yang lebih modern.

Buat `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Catatan**: Kita pakai `target: "es6"` (setara ES2015) karena cukup untuk Node.js modern dan kompatibel dengan library yang kita pakai.

Buat struktur folder backend:

```bash
mkdir -p src/{config,types,controllers,routes,services,utils}
```

Tambahkan scripts di `package.json`:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Catatan**: Script `dev` menggunakan `src/server.ts` (untuk local development dengan `app.listen()`), sedangkan build/start menggunakan `dist/index.js` (untuk Vercel serverless tanpa listen).

## Langkah 3: Setup Frontend

Kembali ke root folder dan buat React app dengan Vite:

```bash
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Install dependencies frontend:

```bash
npm install zustand axios lucide-react clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
```

**Packages Explained**:
- `zustand`: State management (lebih simple dari Redux)
- `axios`: HTTP client untuk API calls
- `lucide-react`: Icon library (CheckCircle, XCircle, Lightbulb)
- `clsx` + `tailwind-merge`: Utility untuk dynamic className

Initialize Tailwind CSS:

```bash
npx tailwindcss init -p
```

**CRITICAL**: Kita pakai Tailwind build system (BUKAN CDN). File `postcss.config.js` dan `tailwind.config.js` akan di-generate otomatis.

Update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00C4CC',
          50: '#E0F9FA',
          100: '#B3F0F3',
          200: '#80E7EB',
          300: '#4DDDE3',
          400: '#26D4DC',
          500: '#00C4CC',
          600: '#00B0B8',
          700: '#009AA1',
          800: '#00848A',
          900: '#006266',
        },
      },
    },
  },
  plugins: [],
}
```

Buat file `src/index.css` untuk Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Penting**: Jangan lupa import `index.css` di `main.tsx` nanti. Custom colors tidak akan work jika pakai Tailwind CDN!

## Langkah 4: Environment Variables

Buat `.env` di folder backend:

```bash
cd ../backend
touch .env
```

Isi `.env`:

```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key_here
```

## Langkah 5: Git Ignore

Buat `.gitignore` di root folder:

```gitignore
# Dependencies
node_modules/
backend/node_modules/
frontend/node_modules/
docs/node_modules/

# Build outputs
dist/
build/
backend/dist/
frontend/dist/
docs/build/

# Environment variables
.env
.env.local
.env.production
backend/.env
frontend/.env

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
```

## Langkah 6: Vercel Configuration

Buat `vercel.json` di root folder:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/src/index.ts",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["backend/**"]
      }
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    { "handle": "filesystem" },
    {
      "src": "/api/(.*)",
      "dest": "/backend/src/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ]
}
```

**Penjelasan Config**:
- `builds[0]`: Compile backend TypeScript ke serverless function
- `builds[1]`: Build frontend React dengan Vite
- `routes[0]`: Serve static files (frontend assets) terlebih dahulu
- `routes[1]`: Route `/api/*` ke backend serverless function
- `routes[2]`: Semua route lain serve frontend (SPA routing)

## Langkah 7: Test Setup

Test backend:

```bash
cd backend
npm run dev
```

Test frontend (terminal baru):

```bash
cd frontend
npm run dev
```

Jika kedua server berjalan tanpa error, setup berhasil!

## Kesimpulan

Project structure sudah siap. Di tutorial berikutnya, kita akan:
- Membuat Express API di backend
- Setup routing dan controllers
- Integrasi dengan Gemini AI

## Langkah Selanjutnya

Lanjut ke [Backend API dengan Express](./02-backend.md) →
