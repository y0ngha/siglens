# PWA 도입 설계 스펙

**날짜:** 2026-05-03  
**범위:** Scope B — manifest 보강 + 수동 Service Worker + 모바일 설치 유도 배너 + iOS 가이드 모달

---

## 1. 결정 사항 요약

| 항목 | 결정 |
|---|---|
| SW 구현 방식 | 수동 작성 (~80줄), 외부 라이브러리 없음 |
| 배너 노출 트리거 | `[symbol]` 페이지에서 AI 분석 결과 확인 후 / fallback: 30초 체류 |
| 배너 dismiss | 세션(메모리) 기반 — 새로고침 시 조건 재충족되면 재노출 |
| 배너 스타일 | Slim Bar (헤더 위, 한 줄) |
| iOS 가이드 UI | Centered Modal + 단계별 스크린샷 카드 (3단계) |
| 인앱 브라우저 정책 | 배너 전체 숨김 (카카오톡, Instagram 등) |
| 모바일 판정 | `userAgentData?.mobile` → fallback UA 파싱 |
| 오프라인 fallback | `/offline.html` 정적 페이지 제공 |

---

## 2. 파일 구조

```
public/
  sw.js                         수동 Service Worker (정적 파일)
  offline.html                  오프라인 fallback 페이지

src/
  components/
    pwa/
      PwaBanner.tsx             설치 유도 배너 (클라이언트 컴포넌트)
      IosInstallModal.tsx       iOS "홈 화면에 추가" 가이드 모달
      usePwaInstall.ts          플랫폼 감지 + 설치 상태 관리 훅
  app/
    layout.tsx                  수정: <PwaBanner /> 삽입 (헤더 위)
    manifest.ts                 수정: screenshots, id, shortcuts, display_override 보강
```

---

## 3. Service Worker

### 캐싱 정책

```
precache (install 시점):
  /_next/static/**      JS chunks, CSS (빌드 시 생성된 static 자산)
  /icons/*, /fonts/*    아이콘, 폰트
  /offline.html         오프라인 fallback 페이지

runtime fetch 핸들러:
  /api/**               → 네트워크 전용, 절대 캐싱 안 함
  /_next/data/**        → 네트워크 전용 (Next.js RSC payload)
  그 외 GET             → Cache-first (stale-while-revalidate)
  네트워크 실패 + HTML  → /offline.html fallback
```

**원칙:** `/api/**`는 어떤 상황에서도 캐싱하지 않는다. 실시간 가격/분석 데이터가 stale로 노출되는 것은 심각한 UX 오류다.

### 생명주기

- `install`: precache 목록 캐싱 후 `skipWaiting()` 호출
- `activate`: 구버전 캐시 정리 후 `clients.claim()`
- `fetch`: 위 정책에 따라 분기

### SW 등록

`PwaBanner` 마운트 시 클라이언트에서 등록.

```ts
// usePwaInstall 내부
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
}, []);
```

`layout.tsx`에 별도 등록 컴포넌트를 두지 않고 `PwaBanner`가 SW 등록까지 담당한다. `PwaBanner`는 모바일에서만 렌더링되므로 SW도 모바일에서만 등록된다.

> **참고:** PWA 설치 가능 조건 자체는 모바일/데스크탑 무관하게 SW가 등록되어야 성립한다. 다만 현재 범위에서는 데스크탑 설치를 유도하지 않으므로 이 제약을 수용한다. 향후 데스크탑 설치 지원이 필요해지면 SW 등록 위치를 `layout.tsx`로 이전한다.

---

## 4. `usePwaInstall` 훅

### 플랫폼 감지

```ts
const isMobile =
  navigator.userAgentData?.mobile
  ?? /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

const isInAppBrowser =
  /KAKAOTALK|Instagram|FBAN|FBAV|Line|NaverApp/i.test(navigator.userAgent);

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches
  || (navigator as { standalone?: boolean }).standalone === true;
```

### 상태

```ts
showBanner: boolean        // 배너 노출 여부
showIosModal: boolean      // iOS 가이드 모달 노출 여부
deferredPrompt: BeforeInstallPromptEvent | null  // Android 설치 프롬프트
```

### 노출 조건

```ts
const canShow = isMobile && !isStandalone && !isInAppBrowser;
```

`triggerBannerReady()`가 호출될 때 `canShow`가 true면 `showBanner = true`.

### 트리거 통합

분석 완료 → `window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'))` → `usePwaInstall`이 수신 → `triggerBannerReady()` 내부 호출.

```ts
// src/components/symbol-page/hooks/useAnalysis.ts — onSuccess 콜백 내부
onSuccess: (data, variables) => {
  // ... 기존 로직 ...
  window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
}

// 30초 fallback — symbol 페이지 클라이언트 컴포넌트에서 진입 시 타이머 등록
useEffect(() => {
  const id = setTimeout(() => {
    window.dispatchEvent(new CustomEvent('siglens:pwa-trigger'));
  }, 30_000);
  return () => clearTimeout(id);
}, []);
```

CustomEvent 방식을 선택한 이유: 분석 컴포넌트와 PWA 배너가 서로를 모르는 상태를 유지. 횡 의존 없음.

### 액션

```ts
handleInstall():
  Android → deferredPrompt.prompt()
  iOS     → showIosModal = true

handleDismiss():
  showBanner = false  // 세션 메모리만. localStorage 없음.

handleModalClose():
  showIosModal = false
```

---

## 5. `PwaBanner` 컴포넌트

**스타일:** Slim Bar — 헤더 위 고정, 한 줄.

```
[ 📈 아이콘 | "SigLens 앱으로 설치하면 더 빠르게 접속할 수 있어요" | [설치하기] | × ]
```

- `'use client'` 컴포넌트
- `usePwaInstall()`에서 `showBanner`, `isIos`, `handleInstall`, `handleDismiss` 수신
- `showBanner`가 false이면 `null` 반환 (공간 차지 없음)
- `handleInstall` 호출 시 Android면 native prompt, iOS면 `IosInstallModal` 오픈

**렌더링 위치** (`app/layout.tsx`):

```tsx
<ReactQueryProvider>
  <PwaBanner />   {/* 헤더 위 */}
  <Header />
  {children}
</ReactQueryProvider>
```

---

## 6. `IosInstallModal` 컴포넌트

**스타일:** Centered Modal, backdrop 클릭 시 닫힘.

3단계 카드로 구성:

| 단계 | 안내 텍스트 | 비주얼 |
|---|---|---|
| 1 | "Safari 하단 공유 버튼을 탭하세요" | 공유 버튼 하이라이트 이미지 |
| 2 | "스크롤 후 '홈 화면에 추가'를 선택하세요" | 공유시트 '홈 화면에 추가' 항목 이미지 |
| 3 | "우측 상단 '추가'를 탭하면 완료!" | 확인 다이얼로그 이미지 |

스크린샷 이미지는 `public/pwa/` 아래 저장. iOS 업데이트 시 교체 필요.

---

## 7. `manifest.ts` 보강

현재 누락된 필드 추가:

```ts
{
  id: '/',                          // PWA 고유 식별자
  display_override: ['standalone'], // display 선호 순서
  screenshots: [                    // Play Store / App Store 스타일 미리보기
    { src: '/og-image.png', sizes: '1200x630', type: 'image/png', form_factor: 'wide' }
  ],
  shortcuts: [                      // 앱 아이콘 롱프레스 단축 메뉴
    { name: '시장 개요', url: '/market', icons: [{ src: '/icon96.png', sizes: '96x96' }] },
    { name: '종목 검색', url: '/?focus=search', icons: [{ src: '/icon96.png', sizes: '96x96' }] }
  ]
}
```

---

## 8. 테스트

| 대상 | 방법 |
|---|---|
| `usePwaInstall` 플랫폼 감지 | `navigator.userAgent`/`userAgentData` mock → 유닛 테스트 |
| 배너 노출 조건 | `isMobile`, `isStandalone`, `isInAppBrowser` 조합별 케이스 |
| CustomEvent 트리거 | `dispatchEvent` mock, `triggerBannerReady` 호출 여부 확인 |
| SW 캐싱 정책 | `/api/` 요청이 캐시에 저장되지 않음 검증 (SW mock) |
| `PwaBanner` 렌더링 | `showBanner = false`이면 DOM에 없음, `true`이면 렌더 |

E2E (수동 검증):
- Android Chrome: 분석 완료 후 배너 노출 → "설치하기" → native prompt 뜨는지
- iOS Safari: 배너 노출 → "설치하기" → 모달 3단계 표시 → 닫기
- 인앱 브라우저(카카오톡): 배너 없음
- 데스크탑 Chrome/Safari: 배너 없음
- Standalone 모드 재접속: 배너 없음

---

## 9. 범위 외 (이번 사이클 미포함)

- Web Push / VAPID 키 / 구독 저장
- 시그널 알림 트리거 연동
- 데스크탑 PWA 설치 유도
- Background Sync
