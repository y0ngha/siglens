# Google Ads 전환 측정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** siglens.io·ai.siglens.io에 Google Ads 태그를 넣고 전환 3종(가입·AI 질문·종목 선택)을 기록하며, ai 핸드오프가 광고 클릭 ID를 보존하게 한다.

**Architecture:** 공개 식별자(AW-ID·라벨)는 `shared/config/googleAds.ts` 상수, 전송은 `shared/lib/googleAds.ts`의 `trackAdsConversion` 하나로 모은다. 태그 로딩은 서버 레이아웃이 판단하고(운영 빌드·비 E2E), 클라이언트 컴포넌트 `GoogleAdsTag`가 gtag.js 로딩과 가입 플래그 쿠키 소비를 맡는다. 개인정보처리방침 v5로 고지한다.

**Tech Stack:** Next.js 16 App Router, `next/script`, Vitest(+jsdom), Testing Library, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-24-google-ads-conversion-design.md`

**Repo rules that change the usual flow**
- 커밋·푸시는 `git-agent`만 한다(CLAUDE.md). 태스크마다 커밋하지 말고 마지막에 한 번에 넘긴다.
- 테스트는 `yarn test <path>`로만 돌린다(`npx vitest` 금지). `.test.ts`는 node 환경, `.test.tsx`는 jsdom 환경이다. `.test.ts`에서 DOM이 필요하면 첫 줄에 `// @vitest-environment jsdom`.
- 로컬 게이트는 스코프만: `npx tsc --noEmit` + 변경 파일 테스트 + `yarn lint`. 전체 스위트·`yarn build`는 돌리지 않는다.
- 워크트리: `/Users/y0ngha/Project/siglens-wt/google-ads` (브랜치 `feat/google-ads-conversion`). `node_modules`가 없으면 메인 레포에서 `cp -al /Users/y0ngha/Project/siglens/node_modules ./node_modules` 후 `ls -d node_modules/node_modules 2>/dev/null && rm -rf node_modules/node_modules`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| Create `src/shared/config/googleAds.ts` | AW-ID·라벨·가입 쿠키 도메인/수명 상수, `AdsConversion` 타입 |
| Modify `src/shared/config/cookieNames.ts` | `SIGNUP_CONVERSION_COOKIE_NAME` |
| Create `src/shared/lib/googleAds.ts` | `trackAdsConversion`, `createSignupConversionCookie`, `consumeSignupConversionFlag` |
| Create `src/shared/lib/__tests__/googleAds.test.ts` | 위 3개 함수 |
| Create `src/app/_components/GoogleAdsTag.tsx` | gtag.js 로딩 + 경로 변경마다 가입 플래그 소비 |
| Create `src/app/_components/__tests__/GoogleAdsTag.test.tsx` | 컴포넌트 |
| Modify `src/app/[locale]/layout.tsx`, `src/app/ai/[locale]/layout.tsx` | `GoogleAdsTag` 마운트 |
| Modify `src/features/auth-signup/actions/registerAction.ts`, `src/features/auth-oauth-consent/actions/finalizeOAuthSignupAction.ts` (+ 각 테스트) | 가입 플래그 쿠키 세팅 |
| Modify `src/features/agent-chat/hooks/useAgentStream.ts` (+ 테스트) | `send`에서 `chatQuestion` |
| Modify `src/features/ticker-search/hooks/useRecentSearches.ts` (+ 테스트) | `addSearch`에서 `tickerSelect` |
| Modify `src/app/ai/[locale]/handoffRedirect.ts` (+ 테스트) | 광고 파라미터 허용 목록 |
| Modify `src/proxy.ts`, `src/app/__tests__/proxy.aiHost.test.ts` | ai 호스트 CSP img-src |
| Create `db/seeds/terms/privacy/v5.md`, `v5.en.md`, `v5.ja.md`, `v5.zh.md` | 개인정보처리방침 v5 |
| Create `src/shared/db/__tests__/scripts/seedTermsFiles.test.ts` | 실제 시드 파일 검증 |

---

### Task 1: 설정 상수와 쿠키 이름

**Files:**
- Create: `src/shared/config/googleAds.ts`
- Modify: `src/shared/config/cookieNames.ts` (파일 끝에 추가)

설정만이라 테스트는 Task 2에서 동작으로 검증한다.

- [ ] **Step 1: `src/shared/config/googleAds.ts` 작성**

```ts
/**
 * Google Ads 전환 측정 설정.
 *
 * ID와 라벨은 모든 방문자의 HTML·요청에 그대로 실리는 공개 식별자라 하드코딩한다
 * (`shared/lib/cloudflareAnalytics.ts`의 beacon token과 같은 이유). Google Ads 전환
 * 액션이 주는 `send_to: 'AW-XXXX/label'`의 앞부분이 ID, 뒷부분이 라벨이다.
 * 값이 비어 있으면 태그도 전환도 전부 꺼진다.
 *
 * 운영 빌드가 아니거나 E2E 빌드면 ID가 빈 문자열이다. 개발 서버에서 한 질문·가입이
 * 광고 전환으로 잡히면 안 되고, E2E는 외부 호스트 요청을 금지한다. `E2E_TEST`는
 * NEXT_PUBLIC이 아니라 클라이언트 번들에서는 항상 undefined다 — 그래서 태그 로드
 * 여부는 서버 컴포넌트인 레이아웃이 이 값으로 판단한다. 클라이언트의
 * `trackAdsConversion`이 E2E에서 dataLayer에 쌓더라도 gtag.js가 없어 요청은 없다.
 *
 * ⚠️ ID를 채우는 배포는 개인정보처리방침 v5 시행일(2026-10-05) 이후여야 한다.
 */
const ADS_ID = '';

export const GOOGLE_ADS_ID =
    process.env.NODE_ENV === 'production' && process.env.E2E_TEST !== '1'
        ? ADS_ID
        : '';

export type AdsConversion = 'signUp' | 'chatQuestion' | 'tickerSelect';

/** 전환 액션별 라벨. 빈 문자열인 전환은 보내지 않는다. */
export const GOOGLE_ADS_CONVERSION_LABELS: Readonly<
    Record<AdsConversion, string>
> = {
    signUp: '',
    chatQuestion: '',
    tickerSelect: '',
};

/**
 * 가입 플래그 쿠키 도메인. ai.siglens.io에서 시작한 가입은 메인 호스트에서 끝나고
 * 핸드오프를 거쳐 ai 페이지로 돌아가므로, 상위 도메인에 둬야 ai 쪽이 읽는다.
 * 태그가 운영 빌드에서만 켜지므로 운영 도메인만 적는다(개발 환경에서는 브라우저가
 * 이 쿠키를 거부하지만 거기선 측정도 꺼져 있다).
 */
export const SIGNUP_CONVERSION_COOKIE_DOMAIN = 'siglens.io';
export const SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS = 600;
```

- [ ] **Step 2: `src/shared/config/cookieNames.ts` 끝에 추가**

```ts

/**
 * Client-readable one-shot flag the sign-up server actions set so the next
 * page can record a Google Ads sign-up conversion (`shared/lib/googleAds.ts`).
 * Value is always "1". Scoped to `siglens.io` so ai.siglens.io reads it too —
 * a bare "signed up" marker leaks nothing to sibling subdomains.
 */
export const SIGNUP_CONVERSION_COOKIE_NAME = 'siglens_signup_conversion';
```

---

### Task 2: 전송 헬퍼

**Files:**
- Create: `src/shared/lib/googleAds.ts`
- Test: `src/shared/lib/__tests__/googleAds.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({
    GOOGLE_ADS_ID: 'AW-1',
    GOOGLE_ADS_CONVERSION_LABELS: {
        signUp: 'L1',
        chatQuestion: 'L2',
        tickerSelect: '',
    },
    SIGNUP_CONVERSION_COOKIE_DOMAIN: 'siglens.io',
    SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS: 600,
}));
vi.mock('@/shared/config/googleAds', () => config);

import {
    consumeSignupConversionFlag,
    createSignupConversionCookie,
    trackAdsConversion,
} from '@/shared/lib/googleAds';

beforeEach(() => {
    config.GOOGLE_ADS_ID = 'AW-1';
    delete window.dataLayer;
});
afterEach(() => vi.restoreAllMocks());

describe('trackAdsConversion', () => {
    it('queues the conversion as an Arguments object (gtag.js ignores arrays)', () => {
        trackAdsConversion('signUp');
        expect(window.dataLayer).toHaveLength(1);
        const entry = window.dataLayer![0];
        expect(Object.prototype.toString.call(entry)).toBe(
            '[object Arguments]'
        );
        expect(Array.from(entry as ArrayLike<unknown>)).toEqual([
            'event',
            'conversion',
            { send_to: 'AW-1/L1' },
        ]);
    });

    it('does nothing for a conversion without a label', () => {
        trackAdsConversion('tickerSelect');
        expect(window.dataLayer).toBeUndefined();
    });

    it('does nothing when the tag id is empty (dev, e2e, not configured)', () => {
        config.GOOGLE_ADS_ID = '';
        trackAdsConversion('signUp');
        expect(window.dataLayer).toBeUndefined();
    });
});

describe('createSignupConversionCookie', () => {
    it('is a 10-minute, client-readable flag on the parent domain', () => {
        expect(createSignupConversionCookie({ secure: true })).toEqual({
            name: 'siglens_signup_conversion',
            value: '1',
            maxAge: 600,
            path: '/',
            domain: 'siglens.io',
            sameSite: 'lax',
            secure: true,
            httpOnly: false,
        });
    });
});

describe('consumeSignupConversionFlag', () => {
    it('returns true and expires the flag with the same domain and path', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue(
            'a=1; siglens_signup_conversion=1'
        );
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeSignupConversionFlag()).toBe(true);
        expect(set).toHaveBeenCalledWith(
            'siglens_signup_conversion=; Max-Age=0; Path=/; Domain=siglens.io'
        );
    });

    it('returns false and writes nothing without the flag', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue('a=1');
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeSignupConversionFlag()).toBe(false);
        expect(set).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/shared/lib/__tests__/googleAds.test.ts`
Expected: FAIL — `Failed to resolve import "@/shared/lib/googleAds"`

- [ ] **Step 3: `src/shared/lib/googleAds.ts` 구현**

```ts
import { SIGNUP_CONVERSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import {
    GOOGLE_ADS_CONVERSION_LABELS,
    GOOGLE_ADS_ID,
    SIGNUP_CONVERSION_COOKIE_DOMAIN,
    SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS,
    type AdsConversion,
} from '@/shared/config/googleAds';

declare global {
    interface Window {
        dataLayer?: unknown[];
    }
}

/**
 * gtag.js 명령 큐에 넣는다. gtag.js는 배열이 아니라 `arguments` 객체만 명령으로
 * 해석하므로 화살표 함수나 rest 인자 배열로 바꾸면 조용히 무시된다.
 * `window.gtag` 대신 dataLayer에 직접 넣는 이유: 스크립트 로드 전에 불려도 큐에
 * 쌓였다가 로드 후 전송된다.
 */
function gtag(..._args: unknown[]): void {
    (window.dataLayer ??= []).push(arguments);
}

/**
 * 전환 1건을 기록한다. ID·라벨이 비었거나 서버에서 불리면 아무것도 하지 않는다.
 * 광고 측정 실패가 가입·질문·검색을 깨면 안 되므로 던지지 않는다.
 */
export function trackAdsConversion(conversion: AdsConversion): void {
    const label = GOOGLE_ADS_CONVERSION_LABELS[conversion];
    if (!GOOGLE_ADS_ID || !label || typeof window === 'undefined') return;
    gtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${label}` });
}

export interface SignupConversionCookie {
    name: string;
    value: string;
    maxAge: number;
    path: string;
    domain: string;
    sameSite: 'lax';
    secure: boolean;
    httpOnly: false;
}

/**
 * 가입 서버 액션이 세팅하는 1회용 플래그. 다음 페이지의 `GoogleAdsTag`가 읽고
 * 지워야 하므로 httpOnly가 아니다.
 */
export function createSignupConversionCookie(params: {
    secure: boolean;
}): SignupConversionCookie {
    return {
        name: SIGNUP_CONVERSION_COOKIE_NAME,
        value: '1',
        maxAge: SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS,
        path: '/',
        domain: SIGNUP_CONVERSION_COOKIE_DOMAIN,
        sameSite: 'lax',
        secure: params.secure,
        httpOnly: false,
    };
}

/**
 * 가입 플래그가 있으면 지우고 true. 세팅할 때와 같은 Domain·Path로 만료시켜야
 * 지워진다(다르면 브라우저가 별개 쿠키로 본다).
 */
export function consumeSignupConversionFlag(): boolean {
    if (typeof document === 'undefined') return false;
    const present = document.cookie
        .split('; ')
        .includes(`${SIGNUP_CONVERSION_COOKIE_NAME}=1`);
    if (present) {
        document.cookie = `${SIGNUP_CONVERSION_COOKIE_NAME}=; Max-Age=0; Path=/; Domain=${SIGNUP_CONVERSION_COOKIE_DOMAIN}`;
    }
    return present;
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/shared/lib/__tests__/googleAds.test.ts`
Expected: PASS (6 tests)

---

### Task 3: `GoogleAdsTag` 컴포넌트와 레이아웃 마운트

**Files:**
- Create: `src/app/_components/GoogleAdsTag.tsx`
- Test: `src/app/_components/__tests__/GoogleAdsTag.test.tsx`
- Modify: `src/app/[locale]/layout.tsx` (CF 비콘 `{CF_BEACON_TOKEN && (...)}` 블록 바로 뒤, `</body>` 앞)
- Modify: `src/app/ai/[locale]/layout.tsx` (`</LocaleProvider>` 바로 뒤, `</body>` 앞)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    consume: vi.fn<() => boolean>(),
    track: vi.fn(),
    pathname: '/',
}));
vi.mock('@/shared/lib/googleAds', () => ({
    consumeSignupConversionFlag: m.consume,
    trackAdsConversion: m.track,
}));
vi.mock('next/navigation', () => ({ usePathname: () => m.pathname }));
vi.mock('next/script', () => ({
    default: ({
        src,
        id,
        children,
    }: {
        src?: string;
        id?: string;
        children?: string;
    }) => (
        <script data-testid={id ?? 'gtag-loader'} data-src={src}>
            {children}
        </script>
    ),
}));

import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';

beforeEach(() => {
    m.consume.mockReset();
    m.track.mockReset();
    m.pathname = '/';
});

describe('GoogleAdsTag', () => {
    it('loads gtag.js for the id with ad personalization off', () => {
        m.consume.mockReturnValue(false);
        const { getByTestId } = render(<GoogleAdsTag id="AW-1" />);
        expect(getByTestId('gtag-loader').getAttribute('data-src')).toBe(
            'https://www.googletagmanager.com/gtag/js?id=AW-1'
        );
        expect(getByTestId('google-ads-init').textContent).toContain(
            "gtag('config','AW-1',{allow_ad_personalization_signals:false})"
        );
    });

    it('records a sign-up conversion when the flag cookie is present', () => {
        m.consume.mockReturnValue(true);
        render(<GoogleAdsTag id="AW-1" />);
        expect(m.track).toHaveBeenCalledWith('signUp');
    });

    it('records nothing without the flag', () => {
        m.consume.mockReturnValue(false);
        render(<GoogleAdsTag id="AW-1" />);
        expect(m.track).not.toHaveBeenCalled();
    });

    it('checks the flag again after a client-side navigation (server-action redirect does not remount)', () => {
        m.consume.mockReturnValue(false);
        const { rerender } = render(<GoogleAdsTag id="AW-1" />);
        m.pathname = '/onboarding';
        m.consume.mockReturnValue(true);
        rerender(<GoogleAdsTag id="AW-1" />);
        expect(m.track).toHaveBeenCalledTimes(1);
        expect(m.track).toHaveBeenCalledWith('signUp');
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/app/_components/__tests__/GoogleAdsTag.test.tsx`
Expected: FAIL — `Failed to resolve import "@/app/_components/GoogleAdsTag"`

- [ ] **Step 3: `src/app/_components/GoogleAdsTag.tsx` 구현**

컴포넌트 선언 형태(반환 타입 표기 여부)는 같은 폴더의 `AuthSessionHeaderClient.tsx`를 따른다.

```tsx
'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
    consumeSignupConversionFlag,
    trackAdsConversion,
} from '@/shared/lib/googleAds';

interface GoogleAdsTagProps {
    id: string;
}

/**
 * Google Ads 태그(gtag.js)와 가입 전환 기록.
 *
 * 레이아웃(서버 컴포넌트)이 `GOOGLE_ADS_ID`가 있을 때만 렌더한다 — 운영 빌드·E2E
 * 여부는 서버에서만 정확히 안다(`shared/config/googleAds.ts`).
 *
 * `allow_ad_personalization_signals: false`로 리마케팅을 끈다. 개인정보처리방침 v5가
 * "맞춤형 광고에 이용하지 않음"을 약속하므로 이 옵션을 지우면 방침이 거짓이 된다.
 *
 * 가입 플래그를 경로가 바뀔 때마다 확인하는 이유: 가입 서버 액션의 redirect는
 * 클라이언트 내비게이션이라 이 컴포넌트가 다시 마운트되지 않는다.
 */
export function GoogleAdsTag({ id }: GoogleAdsTagProps) {
    const pathname = usePathname();
    useEffect(() => {
        if (consumeSignupConversionFlag()) trackAdsConversion('signUp');
    }, [pathname]);
    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
                strategy="afterInteractive"
            />
            <Script id="google-ads-init" strategy="afterInteractive">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{allow_ad_personalization_signals:false});`}
            </Script>
        </>
    );
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/app/_components/__tests__/GoogleAdsTag.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 메인 레이아웃 마운트** — `src/app/[locale]/layout.tsx`

import 추가(기존 `CF_BEACON_TOKEN` import 근처):

```tsx
import { GoogleAdsTag } from '@/app/_components/GoogleAdsTag';
import { GOOGLE_ADS_ID } from '@/shared/config/googleAds';
```

CF 비콘 블록(`{CF_BEACON_TOKEN && (<Script ... />)}`) 바로 뒤, `</body>` 앞:

```tsx
                {/* Google Ads 전환 측정. 운영 빌드에서 ID가 있을 때만 로드한다 —
                    판단 근거는 shared/config/googleAds.ts. */}
                {GOOGLE_ADS_ID && <GoogleAdsTag id={GOOGLE_ADS_ID} />}
```

- [ ] **Step 6: ai 레이아웃 마운트** — `src/app/ai/[locale]/layout.tsx`

같은 두 import를 추가하고, `</LocaleProvider>` 바로 뒤 `</body>` 앞:

```tsx
                {/* Google Ads 전환 측정(질문 전송·가입). 판단 근거는
                    shared/config/googleAds.ts. */}
                {GOOGLE_ADS_ID && <GoogleAdsTag id={GOOGLE_ADS_ID} />}
```

- [ ] **Step 7: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

---

### Task 4: 가입 서버 액션 2곳에 플래그 쿠키

**Files:**
- Modify: `src/features/auth-signup/actions/registerAction.ts` (인증 힌트 쿠키 `cookieStore.set(createAuthHintCookie(...))` 바로 뒤)
- Modify: `src/features/auth-oauth-consent/actions/finalizeOAuthSignupAction.ts` (같은 위치)
- Test: `src/features/auth-signup/__tests__/actions/registerAction.test.ts`
- Test: `src/features/auth-oauth-consent/__tests__/actions/finalizeOAuthSignupAction.test.ts`

- [ ] **Step 1: registerAction 테스트 보강**

`'회원가입 + 자동 로그인 성공 시 name과 next를 반영해 redirect한다'` 테스트 끝(기존 `expect(setSpy)...value: 'tok'` 뒤)에 추가:

```ts
            expect(setSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'siglens_signup_conversion',
                    value: '1',
                    domain: 'siglens.io',
                    httpOnly: false,
                })
            );
```

`'회원가입 성공 후 자동 로그인이 실패하면 auto_login_failed 에러를 반환한다'` 테스트 끝에 추가:

```ts
            expect(setSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({ name: 'siglens_signup_conversion' })
            );
```

- [ ] **Step 2: OAuth 테스트 보강**

`'성공 시 세션 쿠키를 설정하고 돌아갈 곳(next)이 없으면 온보딩 화면으로 리다이렉트'` 테스트의 `expect(mockCookieSet).toHaveBeenCalledTimes(2);`를 다음으로 바꾼다:

```ts
        // 세션 · 인증 힌트 · 가입 전환 플래그
        expect(mockCookieSet).toHaveBeenCalledTimes(3);
        expect(mockCookieSet).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'siglens_signup_conversion',
                value: '1',
                domain: 'siglens.io',
            })
        );
```

- [ ] **Step 3: 실패 확인**

Run: `yarn test src/features/auth-signup/__tests__/actions/registerAction.test.ts src/features/auth-oauth-consent/__tests__/actions/finalizeOAuthSignupAction.test.ts`
Expected: FAIL — 새 단언 2건(`siglens_signup_conversion` 미호출, 호출 횟수 2≠3)

- [ ] **Step 4: 두 액션 구현**

두 파일 모두 import 추가:

```ts
import { createSignupConversionCookie } from '@/shared/lib/googleAds';
```

두 파일 모두 `cookieStore.set(createAuthHintCookie({ ... }));` 문장 바로 뒤에 추가(두 액션 모두 그 스코프에 `secure` 변수가 있다):

```ts
        // 신규 계정 생성이 확정된 뒤에만 도달한다 — 다음 페이지의 GoogleAdsTag가
        // 이 플래그를 읽어 가입 전환을 한 번 기록하고 지운다.
        cookieStore.set(createSignupConversionCookie({ secure }));
```

- [ ] **Step 5: 통과 확인**

Run: 위 Step 3 명령
Expected: PASS

---

### Task 5: 질문 전송 전환

**Files:**
- Modify: `src/features/agent-chat/hooks/useAgentStream.ts` (`send` 콜백)
- Test: `src/features/agent-chat/__tests__/useAgentStream.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

파일 상단 import 아래에 mock 추가:

```ts
const trackAdsConversion = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/googleAds', () => ({ trackAdsConversion }));
```

`describe('useAgentStream', ...)` 안에 테스트 추가:

```ts
    it('send records one chatQuestion conversion; regenerate records none', async () => {
        trackAdsConversion.mockClear();
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
            sse([
                'event: meta\ndata: {"conversationId":"c1","userMessageId":"m1"}',
                'event: text\ndata: {"delta":"ok"}',
                'event: done\ndata: {"assistantMessageId":"m2"}',
            ])
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('AAPL?');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(trackAdsConversion).toHaveBeenCalledTimes(1);
        expect(trackAdsConversion).toHaveBeenCalledWith('chatQuestion');
    });
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/features/agent-chat/__tests__/useAgentStream.test.tsx`
Expected: FAIL — `expected "spy" to be called 1 times, but got 0 times`

- [ ] **Step 3: 구현**

import 추가:

```ts
import { trackAdsConversion } from '@/shared/lib/googleAds';
```

`send` 콜백에서 `updateMessages(prev => [...])` 호출 바로 뒤, `return run(` 앞:

```ts
            // 새 질문만 센다 — edit·regenerate·retry는 같은 질문의 재요청이다.
            trackAdsConversion('chatQuestion');
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/features/agent-chat/__tests__/useAgentStream.test.tsx`
Expected: PASS (기존 테스트 포함 전부)

---

### Task 6: 종목 선택 전환

**Files:**
- Modify: `src/features/ticker-search/hooks/useRecentSearches.ts` (`addSearch`)
- Test: `src/features/ticker-search/__tests__/hooks/useRecentSearches.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `vi.mock('@/entities/ticker', ...)` 아래에 추가:

```ts
const mockTrackAdsConversion = vi.fn();
vi.mock('@/shared/lib/googleAds', () => ({
    trackAdsConversion: (...args: unknown[]) =>
        mockTrackAdsConversion(...args),
}));
```

파일 끝에 추가:

```ts
describe('addSearch — ad conversion', () => {
    it('records a tickerSelect conversion each time a ticker is picked', () => {
        mockTrackAdsConversion.mockClear();
        const { result } = renderHook(() => useRecentSearches());
        act(() => {
            result.current.addSearch({ symbol: 'NVDA', label: 'NVIDIA' });
        });
        expect(mockTrackAdsConversion).toHaveBeenCalledTimes(1);
        expect(mockTrackAdsConversion).toHaveBeenCalledWith('tickerSelect');
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/features/ticker-search/__tests__/hooks/useRecentSearches.test.ts`
Expected: FAIL — `expected "spy" to be called 1 times, but got 0 times`

- [ ] **Step 3: 구현**

import 추가:

```ts
import { trackAdsConversion } from '@/shared/lib/googleAds';
```

`addSearch`를 다음으로 바꾼다:

```ts
    const addSearch = useCallback((entry: string | RecentSearchEntry) => {
        addRecentSearch(entry);
        notify();
        // 검색에서 종목을 고르는 모든 경로(오버레이·패널 자동완성·최근 검색 클릭)가
        // 여기를 지난다 — 호출부마다 넣는 대신 한 곳에서 센다.
        trackAdsConversion('tickerSelect');
    }, []);
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/features/ticker-search/__tests__/hooks/useRecentSearches.test.ts src/features/ticker-search/__tests__/hooks/useRecentSearchesBranches.test.tsx`
Expected: PASS

---

### Task 7: 핸드오프에서 광고 파라미터 보존

**Files:**
- Modify: `src/app/ai/[locale]/handoffRedirect.ts`
- Test: `src/app/ai/[locale]/__tests__/handoffRedirect.test.ts`

핸드오프 뒤 단계(`resolveHandoffNext` → consume/fallback)는 이미 `next`의 쿼리를 보존한다. 운영 실측: `ai.siglens.io/?q=NVDA%20test` → `ai.siglens.io/?q=NVDA+test&sso=none`.

- [ ] **Step 1: 실패하는 테스트 작성** (`describe` 안, 기존 `?q=` 테스트 뒤)

```ts
    it('carries ad attribution params (gclid, utm_*) through next and drops the rest', async () => {
        await expect(
            maybeHandoffRedirect('ko', '/', {
                gclid: 'G1',
                utm_source: 'google',
                utm_campaign: 'b',
                foo: 'x',
            })
        ).rejects.toThrow('NEXT_REDIRECT');
        expect(m.redirect).toHaveBeenCalledWith(
            `/api/auth/handoff/start?next=${encodeURIComponent('/?gclid=G1&utm_source=google&utm_campaign=b')}`
        );
    });
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test 'src/app/ai/[locale]/__tests__/handoffRedirect.test.ts'`
Expected: FAIL — 실제 호출이 `next=%2F`(파라미터 없음)

- [ ] **Step 3: 구현**

`maybeHandoffRedirect` 위에 상수 추가:

```ts
/**
 * 핸드오프 왕복에서 살려 보낼 쿼리. `q`는 siglens.io의 질문 진입 링크, 나머지는
 * 광고 클릭 식별자와 캠페인 태그다 — 버리면 광고에서 온 방문의 전환이 광고와
 * 연결되지 않는다. 목록 밖 파라미터는 버린다.
 */
const CARRIED_PARAMS = [
    'q',
    'gclid',
    'gbraid',
    'wbraid',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
] as const;
```

함수 안의 다음 세 줄(주석 포함)을:

```ts
    // A prefilled question (`?q=`, the entry links from siglens.io) must survive
    // the round trip, otherwise a signed-in user lands on an empty composer.
    const q = typeof searchParams.q === 'string' ? searchParams.q : '';
    const next = `${localePath(resolved, path)}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
```

다음으로 바꾼다(기존 `?q=` 테스트가 `encodeURIComponent` 형식을 단언하므로 `URLSearchParams`의 `+` 인코딩을 쓰지 않는다):

```ts
    // `?q=` must survive the round trip (otherwise a signed-in user lands on an
    // empty composer), and so must ad click ids (otherwise the visit loses its ad).
    const query = CARRIED_PARAMS.flatMap(key => {
        const value = searchParams[key];
        return typeof value === 'string' && value
            ? [`${key}=${encodeURIComponent(value)}`]
            : [];
    }).join('&');
    const next = `${localePath(resolved, path)}${query ? `?${query}` : ''}`;
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test 'src/app/ai/[locale]/__tests__/handoffRedirect.test.ts'`
Expected: PASS (기존 `?q=` 테스트 포함)

---

### Task 8: ai 호스트 CSP

**Files:**
- Modify: `src/proxy.ts` (`const AI_CSP = ...`)
- Test: `src/app/__tests__/proxy.aiHost.test.ts`

`img-src`를 좁힌 이유는 원 설계(`docs/superpowers/specs/2026-09-11-ai-siglens-agent-chat-design.md` 출력 위생)의 "이미지 비콘 유출 차단"이다. `AgentMarkdown`은 `img`를 렌더하지 않으므로 Google 호스트만 여는 것은 그 방어와 충돌하지 않는다.

- [ ] **Step 1: 테스트 기대값 변경**

`proxy.aiHost.test.ts`의 기대값:

```ts
            "frame-ancestors 'none'; img-src 'self' data:"
```

을 다음으로:

```ts
            "frame-ancestors 'none'; img-src 'self' data: https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.co.kr"
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/app/__tests__/proxy.aiHost.test.ts`
Expected: FAIL — 헤더 불일치

- [ ] **Step 3: 구현** — `src/proxy.ts`

```ts
/**
 * `img-src`를 좁히는 이유는 모델 출력에 섞인 이미지 URL로 대화 내용을 빼내는 경로를
 * 막기 위해서다(agent-chat 설계 "출력 위생"). Google Ads 전환 픽셀 호스트만 연다 —
 * Google 태그 CSP 가이드의 Ads 이미지 목록. 국가 도메인은 와일드카드가 안 돼서
 * 광고 대상인 한국만 넣었다.
 */
// ponytail: google.co.kr only — add each google.<TLD> if ads target other countries.
const AI_CSP =
    "frame-ancestors 'none'; img-src 'self' data: https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.co.kr";
```

- [ ] **Step 4: 통과 확인**

Run: `yarn test src/app/__tests__/proxy.aiHost.test.ts src/app/__tests__/proxy.test.ts`
Expected: PASS

---

### Task 9: 개인정보처리방침 v5 (4개 로케일)

**Files:**
- Create: `db/seeds/terms/privacy/v5.md`, `v5.en.md`, `v5.ja.md`, `v5.zh.md`
- Test: `src/shared/db/__tests__/scripts/seedTermsFiles.test.ts`

v4를 복사하고 frontmatter를 바꾼 뒤, 각 로케일에서 기준 줄(접두사로 식별, 파일마다 정확히 1개) 바로 뒤에 문단을 넣는다. 줄 번호로 자르지 않는다 — 접두사가 1개가 아니면 멈춘다.

- [ ] **Step 1: 실패하는 테스트 작성** — `src/shared/db/__tests__/scripts/seedTermsFiles.test.ts`

```ts
import path from 'path';
import { glob } from 'glob';
import { describe, expect, it } from 'vitest';
import { parseSeedFile, validateSeedFiles } from '@/../db/scripts/seedTerms';

describe('db/seeds/terms (real files)', () => {
    it('every seed parses and the set validates (no version gap, no orphan translation)', async () => {
        const root = path.resolve(process.cwd(), 'db/seeds/terms');
        const files = await glob('**/*.md', { cwd: root, absolute: true });
        const seeds = files.map(parseSeedFile);
        expect(() => validateSeedFiles(seeds)).not.toThrow();
        expect(
            seeds
                .filter(s => s.kind === 'privacy' && s.version === 5)
                .map(s => s.locale ?? 'ko')
                .toSorted()
        ).toEqual(['en', 'ja', 'ko', 'zh']);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn test src/shared/db/__tests__/scripts/seedTermsFiles.test.ts`
Expected: FAIL — `expected [] to deeply equal [ 'en', 'ja', 'ko', 'zh' ]`

- [ ] **Step 3: v5 파일 생성 스크립트 실행**

아래를 `/tmp`가 아닌 세션 scratchpad에 `make_privacy_v5.py`로 저장하고 워크트리 루트에서 `python3 <path>/make_privacy_v5.py` 실행.

```python
from pathlib import Path

ROOT = Path('db/seeds/terms/privacy')

# (기준 줄 접두사, 그 줄 뒤에 넣을 텍스트). 넣을 텍스트는 앞에 줄바꿈 없이 쓴다.
INSERTS = {
    'ko': {
        'src': 'v4.md', 'dst': 'v5.md',
        'front': ('version: 4\neffectiveDate: 2026-09-14T00:00:00+09:00',
                  'version: 5\neffectiveDate: 2026-10-05T00:00:00+09:00'),
        'after': [
            ('- 접속 통계(방문자 수 집계): IP 주소와',
             '- 광고 성과 측정(Google Ads 전환 추적): 서비스 페이지에 포함된 Google 태그가 Google 광고 쿠키 식별자, 광고를 클릭해 방문한 경우 광고 클릭 식별자(gclid 등), IP 주소, User-Agent, 방문한 페이지 주소, 전환 행동(회원가입 완료·SiglensAI 질문 전송·종목 검색 선택)의 종류와 시각을 Google에 전송합니다. 이름·이메일 등 이용자를 직접 식별하는 정보는 전송하지 않으며, 맞춤형 광고(리마케팅)에는 이용하지 않습니다.'),
            ('- 서비스 품질 개선:',
             '- 광고 성과 측정: 광고로 방문한 이용자가 회원가입·SiglensAI 질문·종목 검색으로 이어졌는지 집계 (맞춤형 광고에는 이용하지 않음)'),
            ('- 쿠키 및 로컬 스토리지: 이용자가',
             '- Google 광고 전환 쿠키(`_gcl_`로 시작): 브라우저에 최대 90일. Google이 처리하는 전환 기록의 보관 기간은 Google의 정책에 따릅니다.\n- 가입 전환 측정용 임시 쿠키(`siglens_signup_conversion`): 발급 후 최대 10분'),
            ('- **DeepSeek** (중국): SiglensAI(ai.siglens.io) 대화',
             '- **Google LLC** (미국): 광고 성과 측정(Google Ads 전환 추적) — 이전 항목: Google 광고 쿠키 식별자, 광고 클릭 식별자(gclid 등), IP 주소, User-Agent, 방문한 페이지 주소, 전환 행동의 종류와 시각. 이전 일시 및 방법: 페이지를 열거나 전환 행동이 일어날 때마다 암호화된 통신으로 전송. 보유 및 이용 기간: Google의 광고 데이터 처리 정책에 따릅니다.'),
            ('- **siglens_session**:',
             '\n광고 성과 측정을 위해 다음 쿠키도 사용합니다. 맞춤형 광고(리마케팅)에는 이용하지 않습니다.\n\n- **`_gcl_`로 시작하는 쿠키(예: `_gcl_au`, `_gcl_aw`)**: Google 태그가 설정하는 광고 전환 쿠키. 광고 클릭과 이후 전환 행동을 연결하는 데 쓰이며, 만료 기간은 최대 90일입니다.\n- **siglens_signup_conversion**: 회원가입 직후 전환을 한 번 기록하기 위한 임시 쿠키. 가입했다는 표시(값 `1`)만 담으며, 전환을 기록하는 즉시 또는 10분 뒤에 삭제됩니다.'),
        ],
        'before_heading': ('## 8.', '광고 전환 쿠키를 거부해도 서비스 이용에는 제약이 없습니다.\n'),
    },
    'en': {
        'src': 'v4.en.md', 'dst': 'v5.en.md',
        'front': ('version: 4', 'version: 5'),
        'after': [
            ('- Access statistics (visitor count aggregation): a pseudonymized',
             '- Advertising performance measurement (Google Ads conversion tracking): the Google tag included in the service\'s pages sends Google advertising cookie identifiers, the ad click identifier (such as gclid) when the user arrived by clicking an ad, the IP address, the User-Agent, the address of the visited page, and the type and time of conversion actions (completing sign-up, sending a question to SiglensAI, selecting a stock in search) to Google. Information that directly identifies the user, such as name or email, is not sent, and this data is not used for personalized advertising (remarketing).'),
            ('- Improving service quality:',
             '- Measuring advertising performance: counting whether users who arrived through an ad went on to sign up, ask SiglensAI a question, or search for a stock (not used for personalized advertising)'),
            ('- Cookies and local storage: until the user',
             '- Google advertising conversion cookies (starting with `_gcl_`): up to 90 days in the browser. The retention of conversion records processed by Google follows Google\'s policies.\n- Temporary sign-up conversion cookie (`siglens_signup_conversion`): up to 10 minutes after it is issued'),
            ('- **DeepSeek** (China): answer generation for SiglensAI',
             '- **Google LLC** (United States): advertising performance measurement (Google Ads conversion tracking) — items transferred: Google advertising cookie identifiers, ad click identifiers (such as gclid), IP address, User-Agent, the address of the visited page, and the type and time of conversion actions. Time and method of transfer: sent over encrypted communication each time a page is opened or a conversion action occurs. Retention and use period: in accordance with Google\'s advertising data processing policies.'),
            ('- **siglens_session**:',
             '\nThe following cookies are also used to measure advertising performance. They are not used for personalized advertising (remarketing).\n\n- **Cookies starting with `_gcl_` (e.g. `_gcl_au`, `_gcl_aw`)**: advertising conversion cookies set by the Google tag. They link an ad click to later conversion actions and expire after up to 90 days.\n- **siglens_signup_conversion**: a temporary cookie used to record a conversion once right after sign-up. It holds only a marker that sign-up happened (value `1`) and is deleted as soon as the conversion is recorded or after 10 minutes.'),
        ],
        'before_heading': ('## 8.', 'Refusing advertising conversion cookies does not restrict use of the service.\n'),
    },
    'ja': {
        'src': 'v4.ja.md', 'dst': 'v5.ja.md',
        'front': ('version: 4', 'version: 5'),
        'after': [
            ('- アクセス統計(訪問者数集計):IPアドレス',
             '- 広告成果の測定(Google広告のコンバージョン測定):サービスのページに含まれるGoogleタグが、Google広告クッキーの識別子、広告をクリックして訪問した場合の広告クリック識別子(gclidなど)、IPアドレス、User-Agent、訪問したページのアドレス、コンバージョン行動(会員登録の完了・SiglensAIへの質問送信・銘柄検索での選択)の種類と日時をGoogleに送信します。氏名・メールアドレスなど利用者を直接識別する情報は送信せず、パーソナライズド広告(リマーケティング)には利用しません。'),
            ('- サービス品質の改善:',
             '- 広告成果の測定:広告から訪問した利用者が会員登録・SiglensAIへの質問・銘柄検索につながったかの集計(パーソナライズド広告には利用しません)'),
            ('- クッキーおよびローカルストレージ:',
             '- Google広告のコンバージョンクッキー(`_gcl_`で始まるもの):ブラウザに最大90日。Googleが処理するコンバージョン記録の保存期間はGoogleのポリシーに従います。\n- 会員登録コンバージョン測定用の一時クッキー(`siglens_signup_conversion`):発行から最大10分'),
            ('- **DeepSeek**(中国):SiglensAI(ai.siglens.io)の会話',
             '- **Google LLC**(米国):広告成果の測定(Google広告のコンバージョン測定) — 移転項目:Google広告クッキーの識別子、広告クリック識別子(gclidなど)、IPアドレス、User-Agent、訪問したページのアドレス、コンバージョン行動の種類と日時。移転の日時および方法:ページを開いたとき、またはコンバージョン行動が発生するたびに暗号化された通信で送信。保有および利用期間:Googleの広告データ処理ポリシーに従います。'),
            ('- **siglens_session**:',
             '\n広告成果の測定のため、次のクッキーも使用します。パーソナライズド広告(リマーケティング)には利用しません。\n\n- **`_gcl_`で始まるクッキー(例:`_gcl_au`、`_gcl_aw`)**:Googleタグが設定する広告コンバージョンクッキー。広告のクリックとその後のコンバージョン行動を結び付けるために使われ、有効期限は最大90日です。\n- **siglens_signup_conversion**:会員登録の直後にコンバージョンを一度だけ記録するための一時クッキー。登録したという印(値`1`)のみを保持し、コンバージョンを記録した時点、または10分後に削除されます。'),
        ],
        'before_heading': ('## 8.', '広告コンバージョンクッキーを拒否しても、サービスの利用に制約はありません。\n'),
    },
    'zh': {
        'src': 'v4.zh.md', 'dst': 'v5.zh.md',
        'front': ('version: 4', 'version: 5'),
        'after': [
            ('- 访问统计(访问者数量统计):存储',
             '- 广告效果衡量(Google Ads转化跟踪):服务页面中包含的Google代码会将Google广告Cookie标识符、通过点击广告访问时的广告点击标识符(gclid等)、IP地址、User-Agent、所访问页面的地址,以及转化行为(完成注册、向SiglensAI发送提问、在搜索中选择股票)的类型和时间发送给Google。不会发送姓名、电子邮箱等可直接识别用户的信息,也不会用于个性化广告(再营销)。'),
            ('- 改善服务质量:',
             '- 衡量广告效果:统计通过广告访问的用户是否进行了注册、向SiglensAI提问或搜索股票(不用于个性化广告)'),
            ('- Cookie及本地存储:',
             '- Google广告转化Cookie(以`_gcl_`开头):在浏览器中最长保留90天。Google处理的转化记录的保留期限依照Google的政策。\n- 注册转化衡量用临时Cookie(`siglens_signup_conversion`):自发放起最长10分钟'),
            ('- **DeepSeek**(中国):SiglensAI(ai.siglens.io)对话',
             '- **Google LLC**(美国):广告效果衡量(Google Ads转化跟踪) — 转移项目:Google广告Cookie标识符、广告点击标识符(gclid等)、IP地址、User-Agent、所访问页面的地址、转化行为的类型和时间。转移时间及方法:每次打开页面或发生转化行为时,通过加密通信发送。保留及使用期限:依照Google的广告数据处理政策。'),
            ('- **siglens_session**:',
             '\n为衡量广告效果,还会使用以下Cookie。这些Cookie不会用于个性化广告(再营销)。\n\n- **以`_gcl_`开头的Cookie(例如`_gcl_au`、`_gcl_aw`)**:由Google代码设置的广告转化Cookie。用于将广告点击与之后的转化行为关联起来,最长有效期为90天。\n- **siglens_signup_conversion**:用于在注册后立即记录一次转化的临时Cookie。仅保存已注册的标记(值为`1`),在记录转化后立即删除,或在10分钟后删除。'),
        ],
        'before_heading': ('## 8.', '拒绝广告转化Cookie不会限制本服务的使用。\n'),
    },
}

for locale, spec in INSERTS.items():
    text = (ROOT / spec['src']).read_text(encoding='utf-8')
    old, new = spec['front']
    assert text.count(old) == 1, (locale, 'frontmatter', old)
    text = text.replace(old, new, 1)
    lines = text.split('\n')
    for prefix, block in spec['after']:
        idx = [i for i, l in enumerate(lines) if l.startswith(prefix)]
        assert len(idx) == 1, (locale, prefix, len(idx))
        lines[idx[0] + 1:idx[0] + 1] = block.split('\n')
    heading, para = spec['before_heading']
    idx = [i for i, l in enumerate(lines) if l.startswith(heading)]
    assert len(idx) == 1, (locale, heading)
    lines[idx[0]:idx[0]] = para.split('\n')
    (ROOT / spec['dst']).write_text('\n'.join(lines), encoding='utf-8')
    print('wrote', spec['dst'])
```

Expected output: `wrote v5.md`, `wrote v5.en.md`, `wrote v5.ja.md`, `wrote v5.zh.md`. `AssertionError`가 나면 해당 로케일 v4의 기준 줄을 열어 접두사를 맞춘다.

- [ ] **Step 4: 결과 눈으로 확인**

Run: `diff db/seeds/terms/privacy/v4.md db/seeds/terms/privacy/v5.md`
Expected: frontmatter 2줄 변경 + 삽입 6곳뿐. 7절은 `siglens_session` 불릿 → 빈 줄 → 광고 쿠키 문단 → 불릿 2개 → 빈 줄 → 기존 거부 문단 → 새 문장 → `## 8.` 순서. 나머지 3개 로케일도 같은 모양인지 `diff`로 확인.

- [ ] **Step 5: 통과 확인**

Run: `yarn test src/shared/db/__tests__/scripts/seedTermsFiles.test.ts src/shared/db/__tests__/scripts/seedTerms.test.ts`
Expected: PASS

---

### Task 10: 게이트

- [ ] **Step 1: 타입** — `npx tsc --noEmit` → 에러 없음
- [ ] **Step 2: 변경 파일 테스트 전부**

```bash
yarn test src/shared/lib/__tests__/googleAds.test.ts \
  src/app/_components/__tests__/GoogleAdsTag.test.tsx \
  src/features/auth-signup/__tests__/actions/registerAction.test.ts \
  src/features/auth-oauth-consent/__tests__/actions \
  src/features/agent-chat/__tests__/useAgentStream.test.tsx \
  src/features/ticker-search/__tests__ \
  'src/app/ai/[locale]/__tests__/handoffRedirect.test.ts' \
  src/app/__tests__/proxy.aiHost.test.ts src/app/__tests__/proxy.test.ts \
  src/shared/db/__tests__/scripts
```

Expected: 전부 PASS

- [ ] **Step 3: lint·포맷·i18n**

```bash
yarn lint
yarn oxfmt --check $(git diff --name-only origin/master -- 'src/**/*.ts' 'src/**/*.tsx')
yarn i18n:lint
```

Expected: lint 경고·에러 0(`exit 0`이어도 출력의 warning 수를 읽는다), 포맷 차이 없음(있으면 `yarn format`), i18n 신규 위반 없음(새 코드에 화면 문구가 없다).

- [ ] **Step 4: 인계** — review-agent → mistake-managing-agent → git-agent 순서(CLAUDE.md 라우팅). PR 본문에 적을 것: ID·라벨은 빈 값이라 병합해도 동작 변화 없음, v5 시행일 2026-10-05, 배포 후 `yarn db:seed:terms` + 공지 팝업, ID 채우는 배포는 10-05 이후.
