# 📌 LearnCheck! Iframe Embed Guide

Panduan untuk embed LearnCheck quiz ke dalam Dicoding Classroom atau platform lain via iframe.

## 🎯 Basic Embed

```html
<iframe 
  src="https://learncheck.vercel.app?tutorial_id={TUTORIAL_ID}&user_id={USER_ID}" 
  width="100%" 
  height="600"
  frameborder="0"
  allow="clipboard-write"
  title="LearnCheck AI Quiz">
</iframe>
```

## 📋 URL Parameters

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `tutorial_id` | string/number | ID tutorial dari Dicoding | `35363` |
| `user_id` | string/number | ID user yang sedang belajar | `1` atau `user-123` |

### Alternative Parameter Names

LearnCheck juga support parameter names yang lebih pendek:

| Alternative | Primary |
|-------------|---------|
| `tutorial` | `tutorial_id` |
| `user` | `user_id` |

Contoh:
```html
<!-- Kedua format ini valid -->
<iframe src="...?tutorial_id=35363&user_id=1"></iframe>
<iframe src="...?tutorial=35363&user=1"></iframe>
```

## 🎨 Features in Embed Mode

LearnCheck secara otomatis mendeteksi iframe context dan:

- ✅ Adjust padding untuk compact layout
- ✅ Support dark/light theme dari user preferences
- ✅ Responsive untuk berbagai ukuran iframe
- ✅ Clear error messages untuk missing parameters

## 🚀 Integration Example

### 1. Dicoding Classroom Integration

```html
<div class="tutorial-quiz">
  <h3>Cek Pemahaman</h3>
  <iframe 
    src="https://learncheck.vercel.app?tutorial_id={{tutorial_id}}&user_id={{user_id}}"
    width="100%" 
    height="600"
    style="border: 1px solid #e2e8f0; border-radius: 8px;">
  </iframe>
</div>
```

### 2. Dynamic User ID

Jika user ID didapat dari session/authentication:

```javascript
const userId = getCurrentUserId(); // Function dari platform
const tutorialId = window.location.pathname.match(/\/tutorials\/(\d+)/)[1];

const iframe = document.createElement('iframe');
iframe.src = `https://learncheck.vercel.app?tutorial_id=${tutorialId}&user_id=${userId}`;
iframe.width = '100%';
iframe.height = '600';
document.getElementById('quiz-container').appendChild(iframe);
```

## 🔧 Local Development Testing

1. Start frontend dev server:
```bash
cd frontend
npm run dev
```

2. Open test page:
```bash
# Open iframe-demo.html in browser
open iframe-demo.html
```

## ⚠️ Error Handling

LearnCheck menampilkan error yang jelas jika parameters missing:

**Missing Parameters:**
```
⚠️ Parameter Tidak Lengkap
Embed URL harus menyertakan tutorial_id dan user_id
Contoh: ?tutorial_id=35363&user_id=1
```

**Invalid User ID:**
```
Gagal memuat preferensi pengguna: User does not exist
```

**Invalid Tutorial ID:**
```
Oops, gagal memuat kuis: Failed to fetch tutorial content
```

## 🎯 Production Deployment

After deploying to Vercel, update embed URL:

```html
<!-- Development -->
<iframe src="http://localhost:5173?tutorial_id=35363&user_id=1"></iframe>

<!-- Production -->
<iframe src="https://learncheck.vercel.app?tutorial_id=35363&user_id=1"></iframe>
```

## 📱 Responsive Height

Untuk iframe yang responsive berdasarkan content:

```javascript
// Listener untuk dynamic height dari iframe
window.addEventListener('message', (event) => {
  if (event.data.type === 'learncheck-resize') {
    const iframe = document.getElementById('quiz-iframe');
    iframe.style.height = event.data.height + 'px';
  }
});
```

## 🔐 Security Considerations

1. **CORS**: Backend sudah configure CORS untuk production domain
2. **CSP**: Pastikan Dicoding Classroom allow iframe dari LearnCheck domain
3. **Sandbox**: Hindari `sandbox` attribute yang terlalu restrictive

## 🎨 Styling Recommendations

```css
.quiz-iframe {
  width: 100%;
  min-height: 600px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .quiz-iframe {
    border-color: #334155;
  }
}
```

## 📞 Support

For issues or questions:
- Check browser console for errors
- Verify tutorial_id exists in Dicoding API
- Verify user_id exists in Dicoding user database
