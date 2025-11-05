# LearnCheck! 🎓

**AI-Powered Quiz Generator for Dicoding Classroom**

LearnCheck! automatically generates personalized quiz questions based on tutorial content using Google Gemini AI, helping students test their understanding immediately after learning.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://learncheck-demo.vercel.app)
[![Redis Cache](https://img.shields.io/badge/Redis-Cache-red)](https://upstash.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

---

## ✨ Features

- 🤖 **AI-Generated Questions**: 3 multiple-choice questions per tutorial using Gemini 2.5 Flash
- ⚡ **Redis Caching**: 12x faster loading with Upstash Redis (16s → 1.3s)
- 🎨 **Real-Time Preferences**: Theme, font size, font style sync instantly (500ms latency)
- 📊 **Progress Tracking**: LocalStorage-based quiz state with per-user/per-tutorial isolation
- 🔒 **Rate Limiting**: 5 quiz generations per minute per user
- 📱 **Responsive Design**: Optimized for both desktop and mobile
- 🌙 **Dark Mode Support**: Follows user preference from Dicoding

---

## 🏗️ Architecture

```
learncheck-demo/
├── backend/              # Express.js API
│   └── src/
│       ├── controllers/  # Request handlers
│       ├── routes/       # API routes
│       ├── services/     # Business logic (Gemini, Dicoding, Redis)
│       └── utils/        # Helper functions
│
├── frontend/             # React + Vite SPA
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── features/     # Feature-based modules (quiz)
│       ├── hooks/        # Custom React hooks
│       ├── services/     # API client
│       └── store/        # Zustand state management
│
└── vercel.json          # Monorepo deployment config
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Gemini API Key ([Get one here](https://ai.google.dev/))
- Redis (Optional - Upstash recommended for production)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Add your GEMINI_API_KEY and REDIS_URL to .env
npm run dev  # Runs on http://localhost:4000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

---

## 🔧 Environment Variables

### Backend (.env)
```env
GEMINI_API_KEY=your_gemini_api_key_here
REDIS_URL=rediss://default:token@endpoint.upstash.io:6379  # Optional
```

### Frontend
No environment variables needed for local development.

---

## 📦 Deployment

### Vercel (Recommended)

1. **Connect Repository**: Import project to Vercel
2. **Add Environment Variables**:
   ```bash
   vercel env add GEMINI_API_KEY production
   vercel env add REDIS_URL production  # Optional but recommended
   ```
3. **Deploy**:
   ```bash
   vercel --prod
   ```

The `vercel.json` config handles the monorepo setup automatically.

---

## 🎯 API Endpoints

### `GET /api/v1/preferences`
Fetch user preferences from Dicoding.

**Query Params**: `user_id`

**Response**:
```json
{
  "userPreferences": {
    "theme": "dark",
    "fontSize": "medium",
    "fontStyle": "default",
    "layoutWidth": "fullWidth"
  }
}
```

### `GET /api/v1/assessment`
Generate or fetch cached quiz for a tutorial.

**Query Params**: `tutorial_id`, `user_id`

**Response**:
```json
{
  "assessment": {
    "questions": [ ... ]
  },
  "userPreferences": { ... },
  "fromCache": true
}
```

---

## 🗄️ Redis Caching Strategy

| Cache Type | TTL | Key Pattern | Purpose |
|------------|-----|-------------|---------|
| Quiz Data | 24h | `learncheck:quiz:tutorial:{id}` | Cache Gemini API responses |
| Rate Limit | 1min | `learncheck:ratelimit:{user_id}` | Prevent API abuse |

**Note**: User preferences are NOT cached to ensure real-time updates.

---

## 🧪 Performance Metrics

### Without Redis
- Quiz Generation: **16 seconds**
- Cost: $0.02 per quiz
- Monthly Cost (100 users/day): **$120**

### With Redis (80% hit rate)
- Cached Quiz: **1.3 seconds** (12x faster!)
- Cache Miss: 16 seconds
- Monthly Cost: **$24** (80% savings!)

---

## 🎨 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite 6** - Build tool
- **TypeScript 5.9** - Type safety
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **ioredis** - Redis client
- **@google/genai** - Gemini AI SDK
- **axios** - HTTP client
- **cheerio** - HTML parsing

### Infrastructure
- **Vercel** - Serverless deployment
- **Upstash Redis** - Managed Redis
- **Dicoding API** - Content source

---

## 📖 Documentation

- [**EMBED.md**](./EMBED.md) - Iframe embedding guide for Dicoding Classroom
- [**REDIS.md**](./REDIS.md) - Redis setup and caching strategy

---

## 🤝 Contributing

This is a demo project for Dicoding Classroom integration. For production use:

1. Add proper authentication
2. Implement user session management
3. Add analytics and monitoring
4. Set up error tracking (Sentry)
5. Add E2E tests

---

## 📄 License

MIT License - feel free to use this project as a reference!

---

## 🙏 Acknowledgments

- **Dicoding Indonesia** - For the learning platform
- **Google Gemini** - For AI capabilities
- **Upstash** - For managed Redis

---

Built with ❤️ for better learning experiences

