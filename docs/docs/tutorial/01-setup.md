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

Install dependencies:

```bash
npm install express cors dotenv axios cheerio @google/genai
npm install -D typescript @types/node @types/express @types/cors ts-node-dev
```

Buat `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

Buat struktur folder:

```bash
mkdir -p src/{config,types,controllers,routes,services,utils}
```

Tambahkan scripts di `package.json`:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

## Langkah 3: Setup Frontend

Kembali ke root folder dan buat React app dengan Vite:

```bash
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Install dependencies tambahan:

```bash
npm install zustand axios lucide-react clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
```

Initialize Tailwind CSS:

```bash
npx tailwindcss init -p
```

Update `tailwind.config.js`:

```javascript
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

Buat `vercel.json` di root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/src/index.ts",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["backend/src/**"]
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
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/backend/src/index.ts"
    },
    {
      "source": "/(.*)",
      "destination": "/frontend/$1"
    }
  ]
}
```

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

## Next Steps

Lanjut ke [Backend API dengan Express](./02-backend.md) →
