---
sidebar_position: 6
---

# Real-Time Preference Updates

User bisa ganti tema, ukuran font, dll di Dicoding Classroom. Kita harus sync perubahan ini ke aplikasi kita secara REAL-TIME (tanpa refresh halaman).

## Tantangan

Aplikasi kita jalan di **iframe** di dalam Dicoding Classroom:

```
Dicoding Classroom (Parent)
  └── LearnCheck iframe (Child)
```

Ketika user ganti preference di parent, gimana cara kasih tahu iframe?

## 3 Strategi Sync

Kita pakai **TRIPLE STRATEGY** untuk update secepat mungkin:

### 1. Polling (500ms)
Cek API setiap 500ms (0.5 detik)

### 2. Debouncing (200ms)
Kalau dapat request baru sebelum 200ms, skip yang lama

### 3. PostMessage (300ms delay)
Parent window kirim event ke iframe via `window.postMessage()`

Kombinasi ini memberikan latency **≤ 500ms**. Hampir instant!

## Custom Hook: useQuizData

Buat `src/hooks/useQuizData.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AssessmentData } from '../types';
import { QUIZ_CONFIG, API_ENDPOINTS } from '../config/constants';

const useQuizData = (tutorialId: string | null, userId: string | null) => {
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState<boolean>(true);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Fetch user preferences with cache busting
  const fetchPreferences = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setIsLoadingPreferences(false);
      return;
    }

    // DEBOUNCING: Prevent rapid-fire requests
    const now = Date.now();
    if (!forceRefresh && now - lastFetchRef.current < QUIZ_CONFIG.DEBOUNCE_MS) {
      console.log('[LearnCheck] Debouncing preference fetch...');
      return;
    }

    lastFetchRef.current = now;
    setIsLoadingPreferences(true);
    setError(null);
    
    try {
      // Add timestamp to prevent browser caching
      const response = await api.get(API_ENDPOINTS.PREFERENCES, {
        params: { 
          user_id: userId,
          _t: Date.now() // Cache buster!
        },
      });
      
      const newPrefs = response.data.userPreferences;
      
      // Only update if actually changed
      const prefsChanged = JSON.stringify(userPreferences) !== JSON.stringify(newPrefs);
      
      if (prefsChanged) {
        console.log('[LearnCheck] Preferences updated:', newPrefs);
        setUserPreferences(newPrefs);
      }
      
    } catch (err: any) {
      console.error('[LearnCheck] Failed to fetch preferences:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [userId, userPreferences]);

  // STRATEGY 1: Initial fetch on mount
  useEffect(() => {
    fetchPreferences(true);
  }, [userId]);

  // STRATEGY 2: Listen for PostMessage from parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Dicoding sends this event when user changes preferences
      if (event.data?.type === 'preference-updated') {
        console.log('[LearnCheck] Received preference update from parent');
        
        // Clear existing timeout
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        
        // Delayed fetch (give backend time to save)
        fetchTimeoutRef.current = setTimeout(() => {
          fetchPreferences(true);
        }, QUIZ_CONFIG.POSTMESSAGE_DELAY_MS);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchPreferences]);

  // STRATEGY 3: Polling when window is focused
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      console.log('[LearnCheck] Starting preference polling...');
      pollInterval = setInterval(() => {
        fetchPreferences();
      }, QUIZ_CONFIG.POLLING_INTERVAL_MS); // 500ms
    };

    const stopPolling = () => {
      if (pollInterval) {
        console.log('[LearnCheck] Stopping preference polling');
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const handleFocus = () => {
      console.log('[LearnCheck] Window focused');
      fetchPreferences(true);
      startPolling();
    };

    const handleBlur = () => {
      console.log('[LearnCheck] Window blurred');
      stopPolling();
    };

    // Start polling if window is already focused
    if (document.hasFocus()) {
      startPolling();
    }

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      stopPolling();
    };
  }, [fetchPreferences]);

  // Generate quiz function
  const generateQuiz = useCallback(async (isRetry: boolean = false) => {
    if (!tutorialId || !userId) {
      setError('Missing tutorial_id or user_id');
      return;
    }

    setIsGeneratingQuiz(true);
    setError(null);
    
    try {
      const response = await api.get(API_ENDPOINTS.ASSESSMENT, {
        params: { 
          tutorial_id: tutorialId, 
          user_id: userId,
          ...(isRetry && { fresh: 'true' }) // Skip cache on retry
        },
      });
      setAssessmentData(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message;
      console.error('[LearnCheck] Quiz generation error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [tutorialId, userId]);

  return { 
    userPreferences, 
    assessmentData, 
    isLoadingPreferences, 
    isGeneratingQuiz, 
    error, 
    generateQuiz,
    refetchPreferences: () => fetchPreferences(true)
  };
};

export default useQuizData;
```

## Penjelasan Detail

### Debouncing

```typescript
const now = Date.now();
if (now - lastFetchRef.current < 200) {
  return; // Skip, too soon!
}
```

Bayangkan user klik preference 10x dalam 1 detik. Tanpa debouncing, kita kirim 10 requests! Dengan debouncing, cuma 1 request yang dikirim. **Hemat bandwidth**.

### PostMessage API

```typescript
window.addEventListener('message', handleMessage);
```

Ini cara standard untuk komunikasi iframe ↔ parent. Parent window bisa kirim event:

```javascript
// Di Dicoding Classroom
iframe.contentWindow.postMessage({
  type: 'preference-updated'
}, '*');
```

### Polling with Focus Detection

```typescript
if (document.hasFocus()) {
  startPolling();
}
```

Polling cuma jalan kalau window **focused** (user lagi lihat tab ini). Kalau user switch ke tab lain, polling berhenti. **Hemat CPU & network**.

### Cache Busting

```typescript
params: { 
  user_id: userId,
  _t: Date.now() // Timestamp unik setiap request
}
```

Browser suka cache GET requests. `_t=1699999999` bikin setiap request unik, jadi browser tidak pake cache. Always fresh data!

## Timeline Example

User ganti theme dark → light:

```
T+0ms:    User klik "Light Mode" di Dicoding
T+50ms:   Dicoding save ke database
T+100ms:  Dicoding kirim postMessage ke iframe
T+400ms:  Iframe fetch API (300ms delay + 100ms network)
T+450ms:  Get response, update UI ✅

Total: 450ms dari klik sampai update!
```

Kalau postMessage gagal (misalnya cross-origin issue), polling akan catch:

```
T+0ms:    User klik "Light Mode"  
T+500ms:  Polling ke-1 (belum ready)
T+1000ms: Polling ke-2 (sudah ready) ✅

Fallback: 1 detik
```

## Optimasi

### 1. Jangan Poll Terlalu Cepat

```typescript
POLLING_INTERVAL_MS: 500 // 0.5 detik OK
POLLING_INTERVAL_MS: 100 // 0.1 detik BOROS!
```

500ms itu sweet spot:
- Cukup cepat (hampir instant)
- Tidak overwhelm backend
- Hemat battery (mobile)

### 2. Stop Polling Saat Tidak Perlu

```typescript
window.addEventListener('blur', stopPolling);
```

User switch tab? Stop polling! Hemat resource.

### 3. Shallow Comparison

```typescript
JSON.stringify(oldPrefs) !== JSON.stringify(newPrefs)
```

Cuma update state kalau preference BENAR-BENAR berubah. Avoid unnecessary re-renders.

## Apply Preferences to UI

Di `App.tsx`:

```typescript
useEffect(() => {
  const root = window.document.documentElement;
  if (preferences.theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}, [preferences.theme]);
```

Add/remove `dark` class di `<html>` element. Tailwind otomatis apply dark mode styles!

## Security Note

PostMessage bisa di-abuse kalau tidak validated:

```typescript
const handleMessage = (event: MessageEvent) => {
  // Validate origin
  if (event.origin !== 'https://dicoding.com') {
    console.warn('Invalid origin:', event.origin);
    return;
  }
  
  // Validate message type
  if (event.data?.type === 'preference-updated') {
    // OK, process it
  }
}
```

Untuk development, kita skip validation. Production harus strict!

## Testing

1. Buka `http://localhost:5173?user_id=1&tutorial_id=123`
2. Buka DevTools Console
3. Lihat logs:
   ```
   [LearnCheck] Starting preference polling...
   [LearnCheck] Preferences updated: { theme: 'light', ... }
   ```
4. Ganti preference di Dicoding mock API
5. Dalam 500ms, UI harus update!

## Kesimpulan

Real-time sync dengan:
- ✅ Polling (500ms interval)
- ✅ Debouncing (200ms cooldown)
- ✅ PostMessage (300ms delay)
- ✅ Focus detection (stop saat blur)
- ✅ Cache busting (timestamp)

Latency ≤ 500ms. Almost instant! 🚀

## Next Steps

Lanjut ke [Redis Caching](./07-redis.md) →
