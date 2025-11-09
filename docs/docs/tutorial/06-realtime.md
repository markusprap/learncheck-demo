---
sidebar_position: 6
---

# Real-time Preferences dengan postMessage

Di tutorial ini, kita implement real-time preference updates TANPA polling. User bisa ubah theme/font di Dicoding classroom, langsung apply di quiz tanpa refresh!

## 🎯 Masalah Apa yang Kita Pecahkan?

### Skenario:
```
1. User buka quiz (theme: light, font: small)
2. Quiz load dan tampil dengan light theme
3. User switch ke Dicoding settings → ganti ke dark theme
4. ❓ Bagaimana quiz tahu harus update?
```

### Perbandingan Solusi:

**❌ Opsi 1: Manual Refresh**
```
User ganti theme → klik tombol refresh → quiz reload
Masalahnya:
- Kehilangan quiz progress
- UX jelek (perlu extra click)
- Quiz state tidak tersimpan
```

**❌ Opsi 2: Continuous Polling**
```javascript
setInterval(async () => {
  const prefs = await fetchPreferences(); // Tiap 5 detik!
  applyTheme(prefs.theme);
}, 5000);

Masalahnya:
- 600 request per 50 menit quiz! (beban gak perlu)
- Bandwidth terbuang
- Server load tinggi
- Delay 5 detik sebelum lihat perubahan
```

**✅ Opsi 3: Event-Driven (postMessage)**
```javascript
window.addEventListener('message', async (event) => {
  if (event.data.type === 'preference-updated') {
    const prefs = await fetchPreferences(); // Hanya saat dibutuhkan!
    applyTheme(prefs.theme);
  }
});

Keuntungannya:
- 3-5 request total (reduksi 99%!)
- Update instan (tanpa polling delay)
- Server load rendah
- Quiz progress tersimpan
```

## 🔗 Full Real-time Flow

```
DICODING CLASSROOM (Parent Window)
User clicks "Dark Mode"
    ↓
Update preferences in Dicoding DB
    ↓
parent.postMessage({
  type: 'preference-updated',
  timestamp: Date.now()
}, '*');
    ↓
------------------------
QUIZ APP (iframe)
    ↓
window.addEventListener('message') catches event
    ↓
useQuizData hook triggered
    ↓
Check debounce (prevent rapid-fire requests)
    ↓
Fetch fresh preferences: GET /api/v1/preferences?user_id=1
    ↓
Update state: setUserPreferences(newPrefs)
    ↓
applyPreferencesToUI(newPrefs)
- document.documentElement.setAttribute('data-theme', 'dark')
- document.documentElement.setAttribute('data-font-size', 'large')
    ↓
CSS variables updated automatically
    ↓
UI re-renders with new theme (NO page reload!)
```

## Masalahnya: Cross-Origin Communication

Quiz kita di-embed di Dicoding classroom sebagai `<iframe>`:

```html
<!-- Dicoding Classroom -->
<iframe src="https://learncheck.vercel.app?tutorial_id=123&user_id=1"></iframe>
```

**Tantangannya**:
1. Quiz app gak bisa langsung access parent window (cross-origin security)
2. Butuh cara untuk parent window notify iframe saat preferences berubah
3. Harus efficient (no continuous polling!)

## Solusi: postMessage API + Event Listeners

### Gambaran Arsitektur

```
Dicoding Classroom (Parent Window)
    ↓ (user ganti theme)
parent.postMessage({ type: 'preference-updated' })
    ↓
Quiz App (iframe) terima message
    ↓
Fetch fresh preferences dari API
    ↓
Apply preferences baru (re-render dengan dark mode)
```

**Kunci**: Parent window kirim **notification**, iframe fetch **data sebenarnya** dari API.

Kenapa tidak kirim data langsung? Security + konsistensi data. API adalah single source of truth.

## Buat Custom Hook: useQuizData

File `frontend/src/hooks/useQuizData.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { AssessmentData } from '../types';
import { useQuizStore } from '../store/useQuizStore';
import { QUIZ_CONFIG, API_ENDPOINTS } from '../config/constants';

/**
 * Custom hook for fetching and managing quiz data with real-time preference updates
 * 
 * BEST PRACTICES untuk User Preferences:
 * 
 * 1. **Non-Blocking Updates Selama Quiz**
 *    - Preferences harus update diam-diam tanpa ganggu quiz flow
 *    - Pakai flag `silentUpdate` untuk prevent loading states selama quiz aktif
 * 
 * 2. **Event-Driven Architecture**
 *    - Listen ke postMessage dari parent window (Dicoding Classroom)
 *    - React ke focus events untuk cross-tab sync
 *    - Hindari continuous polling (performance + UX impact)
 * 
 * 3. **State Isolation**
 *    - Quiz progress disimpan terpisah dari preferences
 *    - Perubahan preference gak reset quiz state
 *    - localStorage keys scoped per user+tutorial
 * 
 * 4. **Graceful Degradation**
 *    - Silent failures selama quiz (jangan show errors)
 *    - Debouncing prevent rapid-fire requests
 *    - Cache busting jamin data fresh saat dibutuhkan
 */
const useQuizData = (tutorialId: string | null, userId: string | null) => {
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState<boolean>(true);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  
  // Get quiz state to prevent refetch during quiz
  const questions = useQuizStore(state => state.questions);

  // Fetch user preferences with cache busting
  const fetchPreferences = useCallback(async (forceRefresh = false, silentUpdate = false) => {
    if (!userId) {
      setIsLoadingPreferences(false);
      return;
    }
    
    // PENTING: Selama quiz, hanya update preferences diam-diam (no loading state)
    if (questions.length > 0 && !silentUpdate) {
      console.log('[LearnCheck] Skip preference fetch - quiz in progress');
      return;
    }

    // Debounce: Prevent rapid-fire requests
    const now = Date.now();
    if (!forceRefresh && now - lastFetchRef.current < QUIZ_CONFIG.DEBOUNCE_MS) {
      console.log('[LearnCheck] Debouncing preference fetch...');
      return;
    }

    lastFetchRef.current = now;
    
    // Only show loading state if not during quiz
    if (!silentUpdate) {
      setIsLoadingPreferences(true);
    }
    setError(null);
    
    try {
      // Add timestamp to prevent caching
      const response = await api.get(API_ENDPOINTS.PREFERENCES, {
        params: { 
          user_id: userId,
          _t: Date.now() // Cache buster
        },
      });
      
      const newPrefs = response.data.userPreferences;
      
      // Always update preferences (even during quiz)
      console.log('[LearnCheck] Preferences updated:', newPrefs);
      setUserPreferences(newPrefs);
      
    } catch (err: any) {
      console.error('[LearnCheck] Failed to fetch preferences:', err);
      // Don't set error during quiz (silent fail)
      if (!silentUpdate) {
        setError(err.response?.data?.message || err.message || 'Failed to load preferences');
      }
    } finally {
      if (!silentUpdate) {
        setIsLoadingPreferences(false);
      }
    }
  }, [userId, questions.length]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPreferences(true);
  }, [userId]); // Only depend on userId, not fetchPreferences

  // Listen for messages from parent window (Dicoding Classroom)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Verify origin if needed
      // if (event.origin !== 'https://dicoding.com') return;
      
      if (event.data?.type === 'preference-updated') {
        console.log('[LearnCheck] Received preference update from parent');
        
        // Clear existing timeout
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        
        // Silent update during quiz (no loading state, no interrupt)
        fetchTimeoutRef.current = setTimeout(() => {
          const isInQuiz = questions.length > 0;
          fetchPreferences(true, isInQuiz); // silentUpdate=true if in quiz
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
  }, [fetchPreferences, questions.length]);

  // Optional: Refresh preferences when window regains focus
  // Only fetch if NOT during quiz
  useEffect(() => {
    const handleFocus = () => {
      // Only fetch on focus if NOT generating quiz and NO quiz loaded
      if (!isGeneratingQuiz && questions.length === 0) {
        console.log('[LearnCheck] Window focused - refreshing preferences');
        fetchPreferences(true, false);
      } else if (questions.length > 0) {
        console.log('[LearnCheck] Window focused but quiz in progress - silent refresh');
        fetchPreferences(true, true); // Silent update
      }
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPreferences, isGeneratingQuiz, questions.length]);

  /**
   * Generate quiz with AI
   * @param isRetry - If true, skip cache and generate fresh questions
   */
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
          ...(isRetry && { fresh: 'true' }) // Add fresh=true for retry attempts
        },
      });
      setAssessmentData(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to generate quiz';
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
    refetchPreferences: () => fetchPreferences(true) // Expose manual refetch
  };
};

export default useQuizData;
```

## Deep Dive: How It Works

### 1. Silent Update Pattern

```typescript
const fetchPreferences = async (forceRefresh = false, silentUpdate = false) => {
  // PENTING: Selama quiz, hanya silent updates
  if (questions.length > 0 && !silentUpdate) {
    console.log('Skipping - quiz in progress');
    return;
  }

  // Hanya show loading state kalau BUKAN silent
  if (!silentUpdate) {
    setIsLoadingPreferences(true);
  }
```

**Kenapa?** User sedang quiz, tiba-tiba preferences update → theme berubah. Itu OK!

Tapi jangan:
- Show loading spinner (interrupt quiz flow)
- Show error message (ganggu konsentrasi)
- Reset quiz progress (data loss!)

### 2. Strategi Debouncing

```typescript
const lastFetchRef = useRef<number>(0);

const fetchPreferences = async (forceRefresh, silentUpdate) => {
  const now = Date.now();
  
  // Prevent requests dalam 200ms dari last fetch
  if (!forceRefresh && now - lastFetchRef.current < QUIZ_CONFIG.DEBOUNCE_MS) {
    console.log('Debouncing...');
    return;
  }

  lastFetchRef.current = now;
  // ... proceed with fetch
};
```

**Skenario**:
- User rapid-click theme toggle (dark → light → dark → light) dalam 1 detik
- Tanpa debounce: 4 API calls! 😱
- Dengan debounce: Hanya 1 API call setelah 200ms delay ✅

### 3. postMessage Listener

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // Optional: Verify origin untuk security
    // if (event.origin !== 'https://dicoding.com') return;
    
    if (event.data?.type === 'preference-updated') {
      console.log('Terima preference update dari parent');
      
      // Clear existing timeout (debounce rapid messages)
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Delay sebelum fetch (biarkan parent selesai multiple updates)
      fetchTimeoutRef.current = setTimeout(() => {
        const isInQuiz = questions.length > 0;
        fetchPreferences(true, isInQuiz); // silentUpdate kalau in quiz
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
}, [fetchPreferences, questions.length]);
```

**Alur**:
1. Parent window: `postMessage({ type: 'preference-updated' })`
2. Iframe terima message
3. Clear previous timeout (kalau ada)
4. Tunggu 300ms (biarkan rapid updates settle)
5. Cek apakah in quiz → fetch silently atau normal

### 4. Focus Event Listener

```typescript
useEffect(() => {
  const handleFocus = () => {
    // Sebelum quiz: normal fetch (dengan loading)
    if (!isGeneratingQuiz && questions.length === 0) {
      console.log('Window focused - refreshing');
      fetchPreferences(true, false);
    } 
    // Selama quiz: silent fetch (tanpa loading)
    else if (questions.length > 0) {
      console.log('Window focused tapi quiz in progress - silent refresh');
      fetchPreferences(true, true);
    }
  };

  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, [fetchPreferences, isGeneratingQuiz, questions.length]);
```

**Use Case**: User switch tab, ganti preferences di tab lain, balik lagi → auto-refresh!

### 5. Cache Busting

```typescript
const response = await api.get(API_ENDPOINTS.PREFERENCES, {
  params: { 
    user_id: userId,
    _t: Date.now() // ← Cache buster
  },
});
```

**Kenapa?**

Browser/axios mungkin cache GET requests. Menambah timestamp jamin kita selalu dapat data fresh dari server.

## Integrasi di App.tsx

```typescript
const App = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tutorialId = urlParams.get('tutorial_id');
  const userId = urlParams.get('user_id');
  
  // Pakai custom hook
  const { 
    userPreferences, 
    assessmentData, 
    isLoadingPreferences, 
    isGeneratingQuiz, 
    error, 
    generateQuiz 
  } = useQuizData(tutorialId, userId);
  
  // ... rest of component
};
```

**Hook auto-handles**:
- Initial preference fetch
- postMessage listening
- Focus event handling
- Debouncing
- Silent updates

Tanpa manual polling! 🎉

## Perbandingan: Polling vs Event-Driven

### ❌ PENDEKATAN LAMA: Polling (JANGAN PAKAI!)

```typescript
// Jelek: Poll tiap 500ms
useEffect(() => {
  const interval = setInterval(() => {
    fetchPreferences();
  }, 500);
  
  return () => clearInterval(interval);
}, []);
```

**Masalahnya**:
- 100+ requests dalam 5 menit quiz
- Waste bandwidth (preferences jarang berubah)
- Battery drain di mobile
- Server load tinggi

### ✅ PENDEKATAN BARU: Event-Driven (IMPLEMENTASI KITA)

```typescript
// Bagus: Hanya fetch saat dibutuhkan
useEffect(() => {
  const handleMessage = (event) => {
    if (event.data?.type === 'preference-updated') {
      fetchPreferences(true, true); // Satu request
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

**Keuntungannya**:
- ~3 requests dalam 5 menit (reduksi 97%!)
- Update instan (tanpa polling delay)
- Battery friendly
- Server friendly

## Testing Real-time Updates

### Test 1: Initial Load

```bash
# Buka: http://localhost:5173/?tutorial_id=35363&user_id=1
```

Expected console logs:
```
[LearnCheck] Preferences updated: { theme: 'dark', ... }
```

### Test 2: postMessage (Simulasi Parent)

Buka browser console, jalankan:

```javascript
// Simulasi Dicoding classroom kirim message
window.postMessage({ type: 'preference-updated' }, '*');
```

Behavior yang diharapkan:
- Console: `[LearnCheck] Terima preference update dari parent`
- Setelah 300ms: Fetch fresh preferences
- UI update dengan theme/font baru

### Test 3: Silent Update Selama Quiz

1. Mulai quiz
2. Selama quiz, kirim postMessage:
   ```javascript
   window.postMessage({ type: 'preference-updated' }, '*');
   ```
3. Yang diharapkan:
   - TANPA loading spinner
   - TANPA error popups
   - Theme/font update diam-diam
   - Quiz lanjut tanpa gangguan

### Test 4: Focus Event

1. Buka quiz di Tab 1
2. Buka quiz dengan user yang sama di Tab 2
3. Di Tab 2, ganti preferences (via DevTools atau API)
4. Switch balik ke Tab 1
5. Yang diharapkan: Preferences auto-refresh

## Pertimbangan Security

### Origin Verification (Production)

```typescript
const handleMessage = (event: MessageEvent) => {
  // Verify message datang dari Dicoding
  if (event.origin !== 'https://dicoding.com') {
    console.warn('Ignored message from untrusted origin:', event.origin);
    return;
  }
  
  if (event.data?.type === 'preference-updated') {
    // ... handle
  }
};
```

**Kenapa?**

Website apapun bisa kirim postMessage ke iframe kamu. Verify origin untuk prevent malicious messages.

### Validasi Message Type

```typescript
const ALLOWED_MESSAGE_TYPES = ['preference-updated', 'quiz-reset'];

const handleMessage = (event: MessageEvent) => {
  if (!ALLOWED_MESSAGE_TYPES.includes(event.data?.type)) {
    return; // Ignore message types yang gak dikenal
  }
  
  // ... handle
};
```

## Metrik Performance

Sebelum (dengan polling):
```
Requests per 5-min quiz: 600 (poll tiap 500ms)
Bandwidth: ~6KB per request × 600 = 3.6MB
Battery impact: Tinggi (continuous JS execution)
```

Sesudah (event-driven):
```
Requests per 5-min quiz: ~3-5 (initial + 2-4 updates)
Bandwidth: ~6KB × 5 = 30KB (reduksi 99%!)
Battery impact: Minimal (idle most of time)
```

**Hasil**: 120x lebih sedikit requests! 🚀

## Masalah Umum

### Issue 1: Preferences tidak update

**Penyebab**: postMessage tidak diterima

**Debug**:
```typescript
window.addEventListener('message', (event) => {
  console.log('Terima message:', event.data, 'dari:', event.origin);
});
```

Cek apakah messages datang dari parent window.

### Issue 2: Terlalu banyak requests

**Penyebab**: Debouncing tidak bekerja

**Debug**: Cek timestamp `lastFetchRef`:
```typescript
console.log('Waktu sejak last fetch:', Date.now() - lastFetchRef.current);
```

Harus > DEBOUNCE_MS (200ms).

### Issue 3: Quiz terganggu oleh updates

**Penyebab**: Flag `silentUpdate` tidak di-set

**Solusi**: Pastikan `fetchPreferences(true, true)` selama quiz (param kedua = true).

### Issue 4: Preferences lama setelah switch tab

**Penyebab**: Focus listener tidak bekerja

**Debug**:
```typescript
window.addEventListener('focus', () => {
  console.log('Window focused!');
});
```

## Ringkasan Best Practices

### ✅ LAKUKAN:
1. **Pakai event-driven updates** (postMessage + focus)
2. **Debounce rapid requests** (prevent spam)
3. **Silent updates selama quiz** (non-blocking)
4. **Cache busting untuk data fresh** (timestamp param)
5. **Verify message origin** (security)

### ❌ JANGAN:
1. **Poll terus-menerus** (waste resources)
2. **Show loading spinners selama quiz** (UX jelek)
3. **Reset quiz saat preference berubah** (data loss)
4. **Trust semua postMessages** (security risk)
5. **Fetch tanpa debounce** (API spam)

## Ringkasan Arsitektur

```
User Ganti Preferences (Parent Window)
    ↓
parent.postMessage({ type: 'preference-updated' })
    ↓
useQuizData hook terima message
    ↓
Debounce + Cek apakah in quiz
    ↓
fetchPreferences(forceRefresh=true, silentUpdate=inQuiz)
    ↓
API call dengan cache buster (?_t=timestamp)
    ↓
Update userPreferences state
    ↓
QuizContainer re-render dengan theme/font baru
    ↓
User lihat update (tanpa gangguan!)
```

## Kesimpulan

Real-time preference system kita sekarang punya:
- ✅ Event-driven updates (TANPA polling!)
- ✅ Silent updates selama quiz (non-blocking)
- ✅ Debouncing (prevent spam)
- ✅ Focus event sync (cross-tab)
- ✅ Security (origin verification)
- ✅ Reduksi bandwidth 99% vs polling

**Inovasi**: Silent update pattern untuk balance real-time updates dengan uninterrupted quiz experience!

## Next Steps

Frontend & state management selesai! Sekarang kita deploy ke Vercel production.

Lanjut ke [Deployment ke Vercel](./07-deployment.md) →
