---
sidebar_position: 7
---

# Deployment ke Vercel

Di tutorial terakhir ini, kita deploy aplikasi LearnCheck! ke Vercel production dengan proper configuration untuk monorepo dan serverless functions.

## Kenapa Vercel?

### vs Heroku / Railway
| Feature | Vercel | Heroku/Railway |
|---------|--------|----------------|
| **Serverless** | Yes (automatic scaling) | No (always-on dyno) |
| **Cold Start** | ~200ms | N/A |
| **Free Tier** | 100GB bandwidth | Limited hours |
| **Auto Deploy** | Git push | Manual or CI/CD |
| **Static + API** | Native support | Separate configs |

### vs Netlify
| Feature | Vercel | Netlify |
|---------|--------|---------|
| **Next.js** | Optimized (same company) | Basic support |
| **Serverless Functions** | Unlimited (free tier) | 125k requests/month |
| **Build Time** | Fast (incremental) | Standard |

**Ringkasan**: Vercel = Terbaik untuk deployment monorepo React + API

## Prasyarat

1. **GitHub Account** - Repository untuk auto-deploy
2. **Vercel Account** - Sign up di [vercel.com](https://vercel.com)
3. **Gemini API Key** - Dari [ai.google.dev](https://ai.google.dev)

## Project Structure Review

```
learncheck-demo/
├── backend/
│   ├── src/
│   │   ├── index.ts      ← Vercel serverless entry point
│   │   ├── server.ts     ← Local dev entry point
│   │   └── ...
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
└── vercel.json           ← Deployment config (CRITICAL!)
```

## Vercel Configuration (vercel.json)

File ini sudah dibuat di Tutorial 01. Mari kita breakdown:

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

### Section 1: builds

```json
"builds": [
  {
    "src": "backend/src/index.ts",
    "use": "@vercel/node",
    "config": {
      "includeFiles": ["backend/**"]
    }
  }
]
```

**Penjelasan**:
- `src`: Entry point untuk backend (HARUS `index.ts`, BUKAN `server.ts`!)
- `use`: Vercel builder untuk Node.js projects
- `includeFiles`: Include semua file di folder `backend/` (dependencies, config, dll.)

**Kenapa `index.ts` bukan `server.ts`?**

```typescript
// ❌ server.ts - Punya app.listen()
app.listen(4000, () => {
  console.log('Server running');
});
// Vercel gak suka ini! Serverless gak bisa "listen"

// ✅ index.ts - Export app saja
export default app;
// Vercel wrap ini dalam serverless handler sendiri
```

### Section 2: Frontend Build

```json
{
  "src": "frontend/package.json",
  "use": "@vercel/static-build",
  "config": {
    "distDir": "dist"
  }
}
```

**Penjelasan**:
- Vercel jalankan `npm run build` di folder `frontend/`
- Build output ke `frontend/dist/`
- Static files served dari CDN (super cepat!)

### Section 3: routes

```json
"routes": [
  { "handle": "filesystem" },    // 1. Cek static files dulu
  {
    "src": "/api/(.*)",           // 2. Route /api/* ke backend
    "dest": "/backend/src/index.ts"
  },
  {
    "src": "/(.*)",               // 3. Sisanya ke frontend
    "dest": "/frontend/$1"
  }
]
```

**Alur Request**:

```
User Request: https://learncheck.vercel.app/api/v1/assessment
    ↓
Cek static files? Tidak
    ↓
Cocok /api/(.*)? Ya!
    ↓
Route ke backend/src/index.ts (serverless function)
    ↓
Express handle /api/v1/assessment
    ↓
Return JSON response

---

User Request: https://learncheck.vercel.app/
    ↓
Cek static files? Tidak
    ↓
Cocok /api/(.*)? Tidak
    ↓
Cocok /(.*)? Ya!
    ↓
Serve frontend/dist/index.html
    ↓
React SPA loads
```

## Frontend Build Configuration

Pastikan `frontend/package.json` punya build script:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",  // ← Vercel runs this
    "preview": "vite preview"
  }
}
```

**Build Process**:
1. `tsc`: Compile TypeScript (type checking)
2. `vite build`: Bundle dan minify
3. Output: folder `frontend/dist/`

## Konfigurasi Backend Build

`backend/package.json`:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",                    // ← Vercel jalankan ini
    "start": "node dist/index.js"
  },
  "main": "dist/index.js"
}
```

**Penting**: Vercel otomatis jalankan `npm run build` untuk backend juga!

## Step-by-Step Deployment

### Step 1: Push to GitHub

```bash
cd learncheck-demo

# Initialize git (if not yet)
git init

# Add all files
git add .

# Commit
git commit -m "chore: Initial commit - LearnCheck! app"

# Create GitHub repo (via GitHub UI or gh CLI)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/learncheck-demo.git
git branch -M main
git push -u origin main
```

### Step 2: Import Project di Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your GitHub repo: `learncheck-demo`
4. Vercel auto-detects monorepo structure!

### Step 3: Configure Build Settings

Vercel should auto-detect dari `vercel.json`, tapi verify:

**Framework Preset**: Other (monorepo)
**Root Directory**: `./` (root folder)
**Build Command**: (auto-detected dari vercel.json)
**Output Directory**: (auto-detected)

### Step 4: Add Environment Variables

**CRITICAL**: Add `GEMINI_API_KEY` di Vercel dashboard!

1. Project Settings → Environment Variables
2. Add variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXX` (your actual key)
   - **Environments**: Production, Preview, Development (check all)

3. Klik **"Save"**

### Step 5: Deploy!

Klik tombol **"Deploy"**.

Proses yang diharapkan:
```
[1/4] Building backend...
  Running "npm install"
  Running "npm run build"
  ✓ Backend built successfully

[2/4] Building frontend...
  Running "npm install"
  Running "npm run build"
  ✓ Frontend built successfully

[3/4] Deploying serverless functions...
  ✓ /api/* → backend/src/index.ts

[4/4] Deploying static assets...
  ✓ Frontend deployed to CDN

✅ Deployment successful!
🚀 https://learncheck-demo.vercel.app
```

### Step 6: Test Production

Buka browser: `https://YOUR-PROJECT.vercel.app/?tutorial_id=35363&user_id=1`

Yang diharapkan:
1. Loading preferences (~0.5s)
2. Intro screen
3. Klik "Mulai" → Loading quiz (~15s)
4. Quiz muncul
5. Selesaikan quiz → Results

**Cek Logs**: Vercel Dashboard → Deployments → [Your Deployment] → Function Logs

## Setup Auto-Deploy

**BONUS**: Vercel auto-deploy pada setiap git push!

```bash
# Buat perubahan
echo "// Test deploy" >> frontend/src/App.tsx

# Commit dan push
git add .
git commit -m "test: Trigger auto-deploy"
git push origin main
```

Vercel otomatis:
1. Deteksi git push
2. Mulai build baru
3. Deploy ke Preview URL
4. Setelah verifikasi, promote ke Production

## Management Environment Variables

### Production vs Preview

- **Production**: `https://learncheck-demo.vercel.app`
- **Preview**: `https://learncheck-demo-git-feature-branch.vercel.app`

Set API keys berbeda kalau butuh:
```
GEMINI_API_KEY (Production): AIzaSy_PROD_KEY
GEMINI_API_KEY (Preview): AIzaSy_DEV_KEY
```

### Akses di Code

Backend (`process.env`):
```typescript
const apiKey = process.env.GEMINI_API_KEY;
```

Frontend (TIDAK BISA AKSES!):
```typescript
// ❌ SALAH - Frontend gak bisa akses backend env vars
const apiKey = process.env.GEMINI_API_KEY; // undefined
```

**Security**: Backend env vars TIDAK exposed ke frontend bundle.

## Custom Domain (Opsional)

### Step 1: Add Domain di Vercel

Project Settings → Domains → Add Domain

Example: `learncheck.dicoding.com`

### Step 2: Configure DNS

Di Dicoding DNS settings, add CNAME record:
```
Type: CNAME
Name: learncheck
Value: cname.vercel-dns.com
```

### Step 3: Verify

Vercel auto-verifies DNS dan provisions SSL certificate.

Setelah ~5 menit: `https://learncheck.dicoding.com` LIVE! 🎉

## Monitoring & Debugging

### Function Logs

Vercel Dashboard → Deployments → [Deployment] → Functions

Cek logs untuk backend errors:
```
[Gemini] SDK initialized successfully
[Assessment] Generating quiz for tutorial 35363
[Gemini] Generating fresh quiz...
```

### Performance Analytics

Vercel Dashboard → Analytics

Cek:
- **Response Times**: Harus < 1s (excluding Gemini AI)
- **Error Rate**: Harus < 1%
- **Bandwidth**: Monitor usage (free tier: 100GB/month)

### Real-time Logs (CLI)

Install Vercel CLI:
```bash
npm install -g vercel
```

Login dan link project:
```bash
vercel login
vercel link
```

Stream logs:
```bash
vercel logs --follow
```

Lihat live requests di terminal! Helpful untuk debugging.

## Masalah Deployment Umum

### Issue 1: Error "Module not found"

**Penyebab**: Dependency hilang di `package.json`

**Solusi**:
```bash
# Backend
cd backend
npm install missing-package --save

# Frontend
cd frontend
npm install missing-package --save

# Commit dan push
git add package.json package-lock.json
git commit -m "fix: Add missing dependency"
git push
```

### Issue 2: "GEMINI_API_KEY not found"

**Penyebab**: Environment variable belum di-set

**Solusi**: 
1. Vercel Dashboard → Project Settings → Environment Variables
2. Tambah `GEMINI_API_KEY`
3. Redeploy (Vercel Dashboard → Deployments → [...] → Redeploy)

### Issue 3: 404 pada /api routes

**Penyebab**: `vercel.json` routing salah konfigurasi

**Debug**: Cek logs di Vercel Dashboard

**Solusi**: Pastikan section `routes` benar:
```json
{
  "src": "/api/(.*)",
  "dest": "/backend/src/index.ts"  // ← Harus point ke index.ts
}
```

### Issue 4: Frontend load, API gagal

**Penyebab**: Backend build gagal

**Debug**: Cek build logs di Vercel Dashboard

Penyebab umum:
- TypeScript errors
- Dependencies hilang
- Node version salah

**Solusi**: Fix errors lokal dulu:
```bash
cd backend
npm run build  # Harus succeed tanpa errors
```

### Issue 5: API responses lambat

**Penyebab**: Cold start (serverless function idle)

**Yang diharapkan**: Request pertama setelah idle ~500ms-1s lebih lambat

**Bukan masalah**: Request selanjutnya cepat (&lt;200ms)

**Kalau persist**: Cek Gemini AI latency (harus ~12-15s)

## Optimisasi Performance

### 1. Edge Caching (Static Assets)

Frontend static files auto-cached di Vercel CDN:
- HTML: `Cache-Control: public, max-age=0, must-revalidate`
- JS/CSS: `Cache-Control: public, max-age=31536000, immutable`

**Hasil**: Lightning-fast load times globally! ⚡

### 2. Function Regions

Default: Serverless functions deploy ke semua region.

Optimisasi untuk region spesifik:
```json
// vercel.json
{
  "functions": {
    "backend/src/index.ts": {
      "memory": 1024,
      "maxDuration": 30,
      "regions": ["sin1"]  // Singapore (terdekat dengan Indonesia)
    }
  }
}
```

### 3. Optimisasi Gemini API

Sudah dioptimasi:
- Model: `gemini-2.5-flash` (varian cepat)
- Parallel data fetching: `Promise.all()`
- HTML parser: Hilangkan tag yang gak perlu

Gak bisa optimasi lebih jauh tanpa menurunkan quality.

## Estimasi Biaya (Free Tier)

Vercel Free Tier:
- **Bandwidth**: 100GB/bulan
- **Function Executions**: Unlimited
- **Build Minutes**: 6000 menit/bulan

**Penggunaan App Kita**:
- Quiz load: ~30KB (HTML + JS + API)
- 100GB ÷ 30KB = ~3.3 juta quiz loads/bulan

**Kesimpulan**: Free tier cukup untuk development + moderate production! 🎉

## Production Checklist

Sebelum launching:

- [ ] Semua environment variables sudah di-set (GEMINI_API_KEY)
- [ ] Build sukses lokal (`npm run build` di kedua folder)
- [ ] TypeScript no errors (`tsc` passes)
- [ ] Test production URL manual
- [ ] Cek Function Logs (no errors)
- [ ] Test di Dicoding Classroom iframe
- [ ] Verify preferences sync bekerja
- [ ] Test quiz flow end-to-end
- [ ] Cek mobile responsive
- [ ] Test dark/light theme toggle
- [ ] Verify timer countdown bekerja
- [ ] Test "Try Again" functionality

## Strategi Rollback

### Kalau deployment gagal:

1. **Vercel Dashboard** → Deployments
2. Cari previous working deployment
3. Klik **"..."** → **"Promote to Production"**
4. Previous version langsung live! (tanpa rebuild)

### Rollback via CLI:

```bash
vercel rollback [deployment-url]
```

**Zero downtime**: Vercel switch traffic instant.

## Workflow Continuous Deployment

Best practice workflow:

```bash
# Feature branch
git checkout -b feature/new-quiz-type

# Buat perubahan
# ... code ...

# Test lokal
npm run build  # Frontend & backend
npm run dev    # Verify works

# Commit dan push
git add .
git commit -m "feat: Add new quiz type"
git push origin feature/new-quiz-type
```

**Vercel otomatis**:
1. Buat Preview deployment: `https://learncheck-demo-git-feature-new-quiz-type.vercel.app`
2. Post comment di GitHub PR dengan preview URL
3. Team bisa test sebelum merge

**Setelah PR approved**:
```bash
git checkout main
git merge feature/new-quiz-type
git push origin main
```

**Vercel otomatis** promote Preview → Production! 🚀

## Best Practices Monitoring

### 1. Setup Vercel Notifications

Project Settings → Notifications

Enable:
- ✅ Deployment Failed
- ✅ Deployment Ready
- ✅ Domain Configuration

Dapat Slack/Email notifications untuk deployment events.

### 2. Function Error Tracking

Install Sentry (opsional):
```bash
npm install @sentry/node
```

```typescript
// backend/src/app.ts
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}
```

Track errors di production dengan detailed stack traces.

### 3. Custom Analytics

Tambah Vercel Analytics (opsional):
```bash
cd frontend
npm install @vercel/analytics
```

```typescript
// frontend/src/main.tsx
import { Analytics } from '@vercel/analytics/react';

root.render(
  <>
    <App />
    <Analytics />
  </>
);
```

Track page views, user interactions, Web Vitals.

## Best Practices Security

### 1. API Rate Limiting

Tambah rate limiting untuk prevent abuse:

```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // limit setiap IP ke 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

// backend/src/app.ts
import { apiLimiter } from './middleware/rateLimiter';

app.use('/api/', apiLimiter);
```

### 2. Konfigurasi CORS

Currently allow semua origins:
```typescript
app.use(cors()); // ❌ Allow all
```

Lock down untuk production:
```typescript
app.use(cors({
  origin: [
    'https://dicoding.com',
    'https://learncheck.vercel.app'
  ],
  credentials: true
})); // ✅ Whitelist saja
```

### 3. Security Environment Variables

- ✅ JANGAN PERNAH commit `.env` ke git
- ✅ Pakai keys berbeda untuk dev/prod
- ✅ Rotate keys rutin (tiap 3 bulan)
- ✅ Verify keys scoped dengan benar (Gemini API key harus punya minimal permissions)

## Kesimpulan

Setup deployment kita sekarang punya:
- ✅ Monorepo dengan separate backend/frontend builds
- ✅ Serverless backend (auto-scaling)
- ✅ CDN-cached frontend (global fast load)
- ✅ Auto-deploy on git push
- ✅ Preview deployments untuk testing
- ✅ Zero-downtime rollbacks
- ✅ Environment variable management
- ✅ Production monitoring & logs

**Production URL**: `https://YOUR-PROJECT.vercel.app`

**Test URL**: `https://YOUR-PROJECT.vercel.app/?tutorial_id=35363&user_id=1`

## 🎉 Project Selesai!

Selamat! Kamu udah berhasil build dan deploy **LearnCheck!** - AI-powered quiz generator yang:

1. ✅ Generate pertanyaan dari tutorial content dengan Gemini AI
2. ✅ Support user preferences (theme, font, layout)
3. ✅ Real-time updates tanpa polling
4. ✅ Persist quiz progress per user per tutorial
5. ✅ Deploy ke production dengan Vercel
6. ✅ Auto-scaling serverless architecture

**Tantangan Selanjutnya**:
- Tambah question difficulty levels
- Implement quiz analytics dashboard
- Tambah leaderboard system
- Support multiple question types (essay, true/false)
- Integrasi dengan Dicoding's actual API

Happy coding! 🚀
