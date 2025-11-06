---
sidebar_position: 7
---

# Deploy ke Vercel

Saatnya deploy aplikasi kita ke production! Vercel adalah platform terbaik untuk deploy React + Node.js monorepo.

## Kenapa Vercel?

- **Zero Configuration**: Deploy dengan 1 command
- **Automatic HTTPS**: SSL certificate gratis
- **Global CDN**: Cepat dari mana aja
- **Serverless Functions**: Auto-scaling, no server management
- **Preview Deployments**: Setiap commit = preview URL
- **Free Tier**: Cukup untuk project hobby

## Prerequisites

1. **GitHub Account**: Push code ke GitHub
2. **Vercel Account**: Sign up di [vercel.com](https://vercel.com)
3. **Environment Variables Ready**:
   - GEMINI_API_KEY

## Step 1: Push ke GitHub

```bash
# Initialize git (kalau belum)
git init
git add .
git commit -m "Initial commit: LearnCheck! application"

# Create repo di GitHub, lalu:
git remote add origin https://github.com/USERNAME/learncheck-demo.git
git branch -M main
git push -u origin main
```

## Step 2: Vercel Configuration

Buat `vercel.json` di **root folder** project:

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

## Penjelasan Vercel Config

### Builds

```json
{
  "src": "backend/src/index.ts",
  "use": "@vercel/node"
}
```

Ini tell Vercel: "backend/src/index.ts adalah serverless function Node.js"

```json
{
  "src": "frontend/package.json",
  "use": "@vercel/static-build"
}
```

Ini tell Vercel: "frontend adalah React app, build dengan `npm run build`"

### Rewrites

```json
{
  "source": "/api/(.*)",
  "destination": "/backend/src/index.ts"
}
```

Request ke `/api/*` → backend serverless function

```json
{
  "source": "/(.*)",
  "destination": "/frontend/$1"
}
```

Request lainnya → frontend static files

## Step 3: Update Backend for Serverless

Vercel serverless function **tidak pakai `app.listen()`**. Update `backend/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1', routes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// IMPORTANT: Export app, don't call listen()
export default app;

// Only listen in development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
```

### Kenapa Export Default?

Vercel expects serverless function export default Express app. Vercel yang handle listen() di production.

## Step 4: Update Frontend Build

Add build script di `frontend/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

Vercel akan jalanin `npm run build` otomatis.

## Step 5: Connect Vercel ke GitHub

1. Login ke [vercel.com](https://vercel.com)
2. Klik "Add New Project"
3. Import GitHub repository
4. Vercel detect monorepo automatically!
5. Klik "Deploy"

## Step 6: Set Environment Variables

Di Vercel dashboard:

1. Go to Project Settings
2. Klik "Environment Variables"
3. Add variable:

```
GEMINI_API_KEY = AIzaSyXXXXXXXXXXXXXXXXX
```

4. Select scope: **Production**, **Preview**, **Development**
5. Save

## Step 7: Redeploy

Setelah add env variable, trigger redeploy:

```bash
# Push any change
git commit --allow-empty -m "Trigger redeploy"
git push
```

Atau di Vercel dashboard: **Deployments** → **Redeploy**

## Step 8: Test Production

URL production: `https://your-project.vercel.app`

Test dengan parameter:
```
https://your-project.vercel.app?tutorial_id=35363&user_id=1
```

Kalau berhasil, kamu akan lihat aplikasi working!

## Step 9: Custom Domain (Optional)

Punya domain sendiri? Connect ke Vercel:

1. Go to Project Settings → Domains
2. Add domain (example: `learncheck.yourdomain.com`)
3. Update DNS records (Vercel kasih instruksi)
4. Wait for SSL certificate (auto, gratis!)

## Embed di Dicoding Classroom

Setelah deploy, kamu bisa embed di Dicoding:

```html
<iframe 
  src="https://your-project.vercel.app?tutorial_id=35363&user_id=1"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>
```

Aplikasi kamu sudah support:
- ✅ Iframe detection
- ✅ PostMessage communication
- ✅ Real-time preference sync
- ✅ Dark mode dari parent

## Monitoring

### 1. Vercel Analytics

Enable di Project Settings → Analytics (gratis!)

Track:
- Page views
- Web Vitals (performance)
- Top pages
- Audience location

### 2. Function Logs

View logs di Vercel dashboard:

1. Go to **Deployments**
2. Click latest deployment
3. Click **Function Logs**

Semua `console.log()` muncul di sini!

### 3. Real-time Logs (CLI)

```bash
npm install -g vercel
vercel login
vercel logs your-project.vercel.app --follow
```

Stream logs real-time di terminal!

## Performance Optimization

### 1. Enable Edge Network

Vercel auto-deploy ke global CDN. Static files (frontend) served dari edge location terdekat user.

```
User di Jakarta → Singapore edge ⚡
User di US → US edge ⚡
```

### 2. Serverless Function Regions

Backend functions default deploy ke US. Untuk Indonesia, request region:

Contact Vercel support untuk regional functions (Pro plan).

### 3. Image Optimization

Kalau pakai image, leverage Vercel Image Optimization:

```typescript
import Image from 'next/image'; // Next.js only

// Or use regular img with CDN
<img src="https://your-cdn.com/image.jpg" />
```

## Troubleshooting

### Build Failed

Check build logs:
1. Go to Deployments
2. Click failed deployment
3. Read build logs

Common issues:
- **TypeScript errors**: Fix locally first, push
- **Missing dependencies**: Check package.json
- **Wrong Node version**: Add `engines` in package.json

```json
{
  "engines": {
    "node": "18.x"
  }
}
```

### Function Timeout

Vercel free tier: **10 second timeout**

Gemini API bisa 15-20 detik! Solusi:
- ✅ Use cache (1.3s after first)
- ✅ Upgrade to Pro ($20/month = 60s timeout)
- ❌ Don't use free tier for production

### Environment Variables Not Working

Check:
1. Scope correct? (Production/Preview/Development)
2. Redeploy after adding variables
3. No typos in variable names

Test via health endpoint:

```typescript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGemini: !!process.env.GEMINI_API_KEY,
  });
});
```

Visit: `https://your-project.vercel.app/api/health`

### CORS Errors

Update backend CORS config:

```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-project.vercel.app',
    'https://dicoding.com',
  ],
  credentials: true,
}));
```

## CI/CD Pipeline

Setiap push ke GitHub → auto deploy!

```
git push → GitHub → Vercel detects → Build → Deploy → Live! 🚀
```

Want staging environment?

1. Create `staging` branch
2. Vercel auto-create preview deployment
3. Test di preview URL
4. Merge ke `main` for production

## Cost Estimation

### Free Tier (Hobby):
- 100 GB bandwidth/month
- 100 hours serverless execution/month
- 6,000 build minutes/month
- **Cost: $0** ✅

Perfect untuk portfolio & small projects!

### Pro Tier ($20/month):
- 1 TB bandwidth
- 1,000 hours execution
- 24,000 build minutes
- Analytics
- Team collaboration

### Enterprise:
- Custom pricing
- SLA guarantee
- Dedicated support

## Best Practices

### 1. Use Environment Stages

```
Production: main branch
Staging: staging branch  
Development: local machine
```

### 2. Enable Preview Deployments

Every PR gets unique URL:
```
https://learncheck-pr-42.vercel.app
```

Perfect untuk review sebelum merge!

### 3. Monitor Performance

Check Vercel Analytics weekly:
- Slow functions? Optimize!
- High bandwidth? Optimize images!
- Many errors? Check logs!

### 4. Automate with GitHub Actions

`.github/workflows/test.yml`:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
```

Run tests before deploy!

## Kesimpulan

Deployment checklist:
- ✅ Push code ke GitHub
- ✅ Configure vercel.json
- ✅ Update backend for serverless
- ✅ Connect Vercel to GitHub
- ✅ Set environment variables
- ✅ Test production URL
- ✅ Enable monitoring

Aplikasi LearnCheck! sekarang:
- Live di internet ✅
- Auto-scaling ✅
- Global CDN ✅
- HTTPS secure ✅
- Ready untuk embed di Dicoding ✅

**SELAMAT! Kamu sudah berhasil membangun aplikasi AI-powered quiz generator dari 0 sampai production!** 🎉

## What's Next?

Ideas untuk pengembangan:
1. **Analytics**: Track completion rate, average score
2. **Leaderboard**: Competitive learning
3. **Multiple Languages**: Support English
4. **Difficulty Levels**: Easy, Medium, Hard questions
5. **Question Pool**: Generate 9 questions, show random 3
6. **Certificate**: Generate certificate kalau perfect score

Keep learning, keep building! 🚀

---

## Butuh Bantuan?

- GitHub Issues: [github.com/markusprap/learncheck-demo/issues](https://github.com/markusprap/learncheck-demo/issues)
- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- Dicoding Discord: [dicoding.com/discord](https://dicoding.com)
