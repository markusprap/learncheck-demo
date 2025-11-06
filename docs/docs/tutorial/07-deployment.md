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

**TL;DR**: Vercel = Best for React + API monorepo deployment

## Prerequisites

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

**Explanation**:
- `src`: Entry point for backend (MUST be `index.ts`, NOT `server.ts`!)
- `use`: Vercel builder for Node.js projects
- `includeFiles`: Include all files in `backend/` folder (dependencies, config, etc.)

**Why `index.ts` not `server.ts`?**

```typescript
// ❌ server.ts - Has app.listen()
app.listen(4000, () => {
  console.log('Server running');
});
// Vercel doesn't like this! Serverless can't "listen"

// ✅ index.ts - Exports app only
export default app;
// Vercel wraps this in its own serverless handler
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

**Explanation**:
- Vercel runs `npm run build` in `frontend/` folder
- Build output goes to `frontend/dist/`
- Static files served dari CDN (super fast!)

### Section 3: routes

```json
"routes": [
  { "handle": "filesystem" },    // 1. Check static files first
  {
    "src": "/api/(.*)",           // 2. Route /api/* to backend
    "dest": "/backend/src/index.ts"
  },
  {
    "src": "/(.*)",               // 3. All else to frontend
    "dest": "/frontend/$1"
  }
]
```

**Request Flow**:

```
User Request: https://learncheck.vercel.app/api/v1/assessment
    ↓
Check static files? No
    ↓
Matches /api/(.*)? Yes!
    ↓
Route to backend/src/index.ts (serverless function)
    ↓
Express handles /api/v1/assessment
    ↓
Return JSON response

---

User Request: https://learncheck.vercel.app/
    ↓
Check static files? No
    ↓
Matches /api/(.*)? No
    ↓
Matches /(.*)? Yes!
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
3. Output: `frontend/dist/` folder

## Backend Build Configuration

`backend/package.json`:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",                    // ← Vercel runs this
    "start": "node dist/index.js"
  },
  "main": "dist/index.js"
}
```

**Important**: Vercel automatically runs `npm run build` untuk backend juga!

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

3. Click **"Save"**

### Step 5: Deploy!

Click **"Deploy"** button.

Expected process:
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

Open browser: `https://YOUR-PROJECT.vercel.app/?tutorial_id=35363&user_id=1`

Expected:
1. Loading preferences (~0.5s)
2. Intro screen
3. Click "Mulai" → Loading quiz (~15s)
4. Quiz appears
5. Complete quiz → Results

**Check Logs**: Vercel Dashboard → Deployments → [Your Deployment] → Function Logs

## Auto-Deploy Setup

**BONUS**: Vercel auto-deploys on every git push!

```bash
# Make a change
echo "// Test deploy" >> frontend/src/App.tsx

# Commit and push
git add .
git commit -m "test: Trigger auto-deploy"
git push origin main
```

Vercel automatically:
1. Detects git push
2. Starts new build
3. Deploys to Preview URL
4. After verification, promotes to Production

## Environment Variables Management

### Production vs Preview

- **Production**: `https://learncheck-demo.vercel.app`
- **Preview**: `https://learncheck-demo-git-feature-branch.vercel.app`

Set different API keys kalau butuh:
```
GEMINI_API_KEY (Production): AIzaSy_PROD_KEY
GEMINI_API_KEY (Preview): AIzaSy_DEV_KEY
```

### Accessing in Code

Backend (`process.env`):
```typescript
const apiKey = process.env.GEMINI_API_KEY;
```

Frontend (TIDAK BISA ACCESS!):
```typescript
// ❌ WRONG - Frontend can't access backend env vars
const apiKey = process.env.GEMINI_API_KEY; // undefined
```

**Security**: Backend env vars TIDAK exposed ke frontend bundle.

## Custom Domain (Optional)

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

Vercel auto-verifies DNS and provisions SSL certificate.

After ~5 minutes: `https://learncheck.dicoding.com` LIVE! 🎉

## Monitoring & Debugging

### Function Logs

Vercel Dashboard → Deployments → [Deployment] → Functions

Check logs untuk backend errors:
```
[Gemini] SDK initialized successfully
[Assessment] Generating quiz for tutorial 35363
[Gemini] Generating fresh quiz...
```

### Performance Analytics

Vercel Dashboard → Analytics

Check:
- **Response Times**: Should be < 1s (excluding Gemini AI)
- **Error Rate**: Should be < 1%
- **Bandwidth**: Monitor usage (free tier: 100GB/month)

### Real-time Logs (CLI)

Install Vercel CLI:
```bash
npm install -g vercel
```

Login and link project:
```bash
vercel login
vercel link
```

Stream logs:
```bash
vercel logs --follow
```

See live requests di terminal! Helpful untuk debugging.

## Common Deployment Issues

### Issue 1: "Module not found" Error

**Cause**: Missing dependency in `package.json`

**Solution**:
```bash
# Backend
cd backend
npm install missing-package --save

# Frontend
cd frontend
npm install missing-package --save

# Commit and push
git add package.json package-lock.json
git commit -m "fix: Add missing dependency"
git push
```

### Issue 2: "GEMINI_API_KEY not found"

**Cause**: Environment variable not set

**Solution**: 
1. Vercel Dashboard → Project Settings → Environment Variables
2. Add `GEMINI_API_KEY`
3. Redeploy (Vercel Dashboard → Deployments → [...] → Redeploy)

### Issue 3: 404 on /api routes

**Cause**: `vercel.json` routing misconfigured

**Debug**: Check logs di Vercel Dashboard

**Solution**: Ensure `routes` section correct:
```json
{
  "src": "/api/(.*)",
  "dest": "/backend/src/index.ts"  // ← Must point to index.ts
}
```

### Issue 4: Frontend loads, API fails

**Cause**: Backend build failed

**Debug**: Check build logs di Vercel Dashboard

Common causes:
- TypeScript errors
- Missing dependencies
- Wrong Node version

**Solution**: Fix errors locally first:
```bash
cd backend
npm run build  # Should succeed without errors
```

### Issue 5: Slow API responses

**Cause**: Cold start (serverless function idle)

**Expected**: First request after idle ~500ms-1s slower

**Not an issue**: Subsequent requests fast (&lt;200ms)

**If persist**: Check Gemini AI latency (should be ~12-15s)

## Performance Optimization

### 1. Edge Caching (Static Assets)

Frontend static files auto-cached di Vercel CDN:
- HTML: `Cache-Control: public, max-age=0, must-revalidate`
- JS/CSS: `Cache-Control: public, max-age=31536000, immutable`

**Result**: Lightning-fast load times globally! ⚡

### 2. Function Regions

Default: Serverless functions deploy ke all regions.

Optimize untuk specific region:
```json
// vercel.json
{
  "functions": {
    "backend/src/index.ts": {
      "memory": 1024,
      "maxDuration": 30,
      "regions": ["sin1"]  // Singapore (closest to Indonesia)
    }
  }
}
```

### 3. Gemini API Optimization

Already optimized:
- Model: `gemini-2.5-flash` (fast variant)
- Parallel data fetching: `Promise.all()`
- HTML parser: Remove unnecessary tags

Can't optimize further without degrading quality.

## Cost Estimation (Free Tier)

Vercel Free Tier:
- **Bandwidth**: 100GB/month
- **Function Executions**: Unlimited
- **Build Minutes**: 6000 minutes/month

**Our App Usage**:
- Quiz load: ~30KB (HTML + JS + API)
- 100GB ÷ 30KB = ~3.3 million quiz loads/month

**Conclusion**: Free tier sufficient untuk development + moderate production! 🎉

## Production Checklist

Before launching:

- [ ] All environment variables set (GEMINI_API_KEY)
- [ ] Build succeeds locally (`npm run build` in both folders)
- [ ] TypeScript no errors (`tsc` passes)
- [ ] Test production URL manually
- [ ] Check Function Logs (no errors)
- [ ] Test di Dicoding Classroom iframe
- [ ] Verify preferences sync works
- [ ] Test quiz flow end-to-end
- [ ] Check mobile responsive
- [ ] Test dark/light theme toggle
- [ ] Verify timer countdown works
- [ ] Test "Try Again" functionality

## Rollback Strategy

### If deployment fails:

1. **Vercel Dashboard** → Deployments
2. Find previous working deployment
3. Click **"..."** → **"Promote to Production"**
4. Previous version instantly live! (no rebuild)

### Rollback via CLI:

```bash
vercel rollback [deployment-url]
```

**Zero downtime**: Vercel switches traffic instantly.

## Continuous Deployment Workflow

Best practice workflow:

```bash
# Feature branch
git checkout -b feature/new-quiz-type

# Make changes
# ... code ...

# Test locally
npm run build  # Both frontend & backend
npm run dev    # Verify works

# Commit and push
git add .
git commit -m "feat: Add new quiz type"
git push origin feature/new-quiz-type
```

**Vercel automatically**:
1. Creates Preview deployment: `https://learncheck-demo-git-feature-new-quiz-type.vercel.app`
2. Posts comment di GitHub PR dengan preview URL
3. Team can test before merge

**After PR approved**:
```bash
git checkout main
git merge feature/new-quiz-type
git push origin main
```

**Vercel automatically** promotes Preview → Production! 🚀

## Monitoring Best Practices

### 1. Setup Vercel Notifications

Project Settings → Notifications

Enable:
- ✅ Deployment Failed
- ✅ Deployment Ready
- ✅ Domain Configuration

Get Slack/Email notifications untuk deployment events.

### 2. Function Error Tracking

Install Sentry (optional):
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

Add Vercel Analytics (optional):
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

## Security Best Practices

### 1. API Rate Limiting

Add rate limiting untuk prevent abuse:

```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

// backend/src/app.ts
import { apiLimiter } from './middleware/rateLimiter';

app.use('/api/', apiLimiter);
```

### 2. CORS Configuration

Currently allow all origins:
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
})); // ✅ Whitelist only
```

### 3. Environment Variables Security

- ✅ NEVER commit `.env` to git
- ✅ Use different keys untuk dev/prod
- ✅ Rotate keys regularly (every 3 months)
- ✅ Verify keys scoped properly (Gemini API key should have minimal permissions)

## Kesimpulan

Deployment setup kita sekarang punya:
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

## 🎉 Project Complete!

Selamat! Kamu udah berhasil build dan deploy **LearnCheck!** - AI-powered quiz generator yang:

1. ✅ Generate pertanyaan dari tutorial content dengan Gemini AI
2. ✅ Support user preferences (theme, font, layout)
3. ✅ Real-time updates tanpa polling
4. ✅ Persist quiz progress per user per tutorial
5. ✅ Deploy ke production dengan Vercel
6. ✅ Auto-scaling serverless architecture

**Next Challenges**:
- Add question difficulty levels
- Implement quiz analytics dashboard
- Add leaderboard system
- Support multiple question types (essay, true/false)
- Integrate dengan Dicoding's actual API

Happy coding! 🚀
