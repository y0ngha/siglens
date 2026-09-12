# SiglensAI 릴리즈 — siglens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ai.siglens.io가 메인 헤더를 공유하고, 메인 헤더에 AI 진입점이 생기며, 제안 질문이 AI 생성이 되고, Composer·메시지·사이드바·빈 화면이 릴리즈 수준으로 정리된다.

**Architecture:** 링크 베이스 컨텍스트 하나로 메인 `Header`를 ai 호스트에서 그대로 렌더한다. 제안은 `entities/agent-suggestions`(server-only)가 core 프롬프트 + 기존 에이전트 프로바이더 + Redis 1h 캐시로 만든다. UI는 siglens 토큰만 쓰고 GPT/Claude의 레이아웃 문법을 따른다.

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4 토큰, vitest + RTL, Playwright. 워크트리 `.claude/worktrees/agent-chat`(브랜치 `feat/agent-chat-release`, base `feat/agent-chat`).

**Spec:** `docs/superpowers/specs/2026-09-12-ai-agent-chat-release-design.md` §4. 디자인 규약: `docs/conventions/DESIGN.md`(§새 화면을 만들 때 필독).

**공통 게이트(모든 태스크):** `yarn typecheck` · `yarn lint`(경고 수 0) · `yarn oxfmt --check <touched>` · `yarn test <touched dirs> src/__tests__/guards src/shared/ui/__tests__` · UI 태스크는 `npx -y react-doctor@latest --scope changed --base feat/agent-chat --no-supply-chain` error 0. 문구 추가 시 `yarn i18n:extract --write` 후 `messages/{en,ja,zh}.json` 번역 채우고 `node scripts/i18n/verify.mjs`.

---

### Task S1: 호스트 인식 링크 베이스

**Files:**
- Modify: `src/shared/i18n/LocaleContext.tsx`
- Modify: `src/shared/ui/LocaleLink.tsx`
- Modify: `src/features/ticker-search/hooks/useAutocomplete.ts` (`router.push(toLocalePath(...))` 분기)
- Modify: `src/features/ticker-search/ui/SearchOverlayProvider.tsx` (`router.replace` 분기)
- Test: `src/shared/ui/__tests__/LocaleLink.test.tsx`(있으면 추가, 없으면 생성), `src/features/ticker-search/hooks/__tests__/useAutocomplete.test.ts`(기존에 추가)

- [ ] **Step 1: 실패 테스트** — `LocaleLink`: `<LocaleProvider locale="en" hrefBase="https://siglens.io"><LocaleLink href="/market">x</LocaleLink></LocaleProvider>` 렌더 시 `a[href="https://siglens.io/en/market"]`; 베이스 없으면 `/en/market`; `href="https://x.y"`·`#a`는 그대로. `useAutocomplete`: 베이스가 있으면 `router.push` 미호출 + `window.location.assign`(`vi.spyOn`)이 `https://siglens.io/en/AAPL`로 호출.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**

```tsx
// LocaleContext.tsx
interface LocaleContextValue { readonly locale: Locale; readonly hrefBase: string }
const LocaleContext = createContext<LocaleContextValue>({ locale: DEFAULT_LOCALE, hrefBase: '' });
export function LocaleProvider({ locale, hrefBase = '', children }: { readonly locale: Locale; readonly hrefBase?: string; readonly children: ReactNode }) { … }
export function useCurrentLocale(): Locale { return useContext(LocaleContext).locale; }
/**
 * 내부 링크 앞에 붙는 오리진. 메인 호스트는 ''(상대 경로), ai.siglens.io는 메인
 * 오리진 — 공유 헤더의 `/market`·`/login`이 ai 호스트에 머물지 않게 한다.
 */
export function useHrefBase(): string { return useContext(LocaleContext).hrefBase; }
```

```tsx
// LocaleLink.tsx — localized 계산 뒤
const base = useHrefBase();
const finalHref = base && typeof localized === 'string' && localized.startsWith('/') ? `${base}${localized}` : localized;
```

검색 두 곳: `const base = useHrefBase();` … `if (base) window.location.assign(`${base}${path}`); else router.push(path);` (SearchOverlayProvider는 `replace` 자리에 같은 분기, `window.location.replace`).

- [ ] **Step 4: 통과 + 게이트** (기존 `LocaleContext`·`LocaleLink`·ticker-search 테스트 전부 포함)
- [ ] **Step 5: 커밋** — `feat(i18n): 링크 베이스 컨텍스트로 공유 헤더 링크를 호스트 인식으로`

---

### Task S2: 메인 헤더 — SiglensAI 링크 + authNext

**Files:**
- Create: `src/widgets/layout/AiNavLink.tsx`
- Modify: `src/widgets/layout/HeaderNav.tsx`, `HeaderNavStatic.tsx`, `HeaderMobileMenu.tsx`, `Header.tsx`, `HeaderUserMenu.tsx`, `index.ts`
- Test: `src/widgets/layout/__tests__/AiNavLink.test.tsx`(신규), `HeaderNav.test.tsx`·`HeaderMobileMenu.test.tsx`·`HeaderUserMenu.test.tsx`·`Header.test.tsx`(추가)

- [ ] **Step 1: 실패 테스트**
  - `AiNavLink`: `href`가 `${AI_SITE_URL}/en`(en) / `${AI_SITE_URL}/`(ko, as-needed), 텍스트 `SiglensAI`, `translate="no"`; `hrefBase`가 설정된 `LocaleProvider` 안에서는 `aria-current="page"`.
  - `HeaderNav`·`HeaderNavStatic`·`HeaderMobileMenu`(드로어 열림)에 `SiglensAI` 링크 존재.
  - `HeaderUserMenu` `authNext="/api/auth/handoff?to=ai&next=%2F"` → 로그인 href가 `/login?next=%2Fapi%2Fauth%2Fhandoff%3Fto%3Dai%26next%3D%252F`(=`encodeURIComponent`), 가입도 동일 규칙; prop 없으면 기존 그대로.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**

```tsx
// AiNavLink.tsx
'use client';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { useCurrentLocale, useHrefBase } from '@/shared/i18n/LocaleContext';
import { localePath } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';

/** 메인 헤더·드로어의 SiglensAI 진입점. ai 호스트(hrefBase 설정)에서는 현재 위치로 표시한다. */
export function AiNavLink({ className, tabIndex }: { readonly className?: string; readonly tabIndex?: number }) {
    const locale = useCurrentLocale();
    const onAiHost = useHrefBase() !== '';
    const href = `${AI_SITE_URL}${localePath(locale, '/')}`;
    return (
        <a
            href={href}
            translate="no"
            aria-current={onAiHost ? 'page' : undefined}
            tabIndex={tabIndex}
            className={cn(
                'inline-flex min-h-11 items-center rounded-full border border-border-control px-3 text-sm font-medium text-primary-300 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                onAiHost && 'bg-secondary-800 text-secondary-100',
                className
            )}
        >
            SiglensAI
        </a>
    );
}
```
  (`text-primary-300`은 다크 카드 위 4.5:1을 확인해 쓴다 — 미달이면 `text-primary-200`. 라이트 테마 값은 `globals.css`의 `:root[data-theme='light']`가 primary-300을 어떻게 재정의하는지 보고 정한다. **네 조합 측정은 S8에서.**)
  - `HeaderNav`/`HeaderNavStatic`: `<nav>` 안 마지막 자식으로 `<AiNavLink />`. `HeaderMobileMenu`: 내비 목록 아래 `<AiNavLink tabIndex={open ? 0 : -1} className="w-full justify-center" />`.
  - `Header`: `readonly authNext?: string` → `HeaderUserMenu authNext`·`HeaderMobileMenu authNext`. 각 컴포넌트에서 `const q = authNext ? `?next=${encodeURIComponent(authNext)}` : ''` 후 `href={`/login${q}`}` / `/signup${q}`.
- [ ] **Step 4: i18n** — 새 문구 없음(브랜드명). `aria-label` 필요 없음(가시 텍스트가 이름).
- [ ] **Step 5: 게이트 + 커밋** — `feat(layout): 메인 헤더에 SiglensAI 진입점과 authNext 추가`

---

### Task S3: ai 레이아웃이 공유 헤더 사용

**Files:**
- Modify: `src/app/ai/[locale]/layout.tsx`, `src/app/ai/[locale]/aiClientPaths.ts`(헤더가 쓰는 메시지 네임스페이스 `widgets.layout`, `features.ticker-search`, `shared.ui` 등 추가), `src/app/_components/AuthSessionHeaderClient.tsx`(`authNext` prop 관통)
- Create: `src/widgets/agent-chat/loginHref.ts` (AiHeader에서 이동, JSDoc 유지)
- Delete: `src/widgets/agent-chat/AiHeader.tsx` (+ 테스트)
- Modify: `src/widgets/agent-chat/ChatShell.tsx`, `EmptyState.tsx`(loginHref import 경로), `index.ts`
- Modify: `e2e/specs/agent-chat.spec.ts`
- Test: `src/widgets/agent-chat/__tests__/ChatShell.test.tsx`

- [ ] **Step 1: 실패 테스트** — ChatShell: `banner` 랜드마크를 렌더하지 않는다(헤더는 레이아웃 소유), 모바일 바의 "대화 목록" 버튼이 드로어를 연다. E2E: ai 호스트 첫 화면에 `getByRole('banner')` 안 `SiglensAI` 링크(`aria-current=page`)와 테마 토글 버튼, 메인 `/`의 헤더 `SiglensAI` 링크 href가 `http://ai.localhost:4300/`로 시작.
- [ ] **Step 2: 구현**
  - layout: `<LocaleProvider locale={locale} hrefBase={SITE_URL}>` → `NextIntlClientProvider` → `ReactQueryProvider` → `SearchOverlayProvider` → `<AuthSessionHeaderClient authNext="/api/auth/handoff?to=ai&next=%2F" />` → children. `disabled` 분기는 헤더 아래 main.
  - `AI_CLIENT_PATHS`에 헤더·검색·테마·언어 스위처가 쓰는 네임스페이스 추가(메인 레이아웃의 `pickMessages` 호출을 참고, 부족하면 렌더 시 next-intl이 MISSING_MESSAGE를 던진다 — RTL 테스트가 잡는다).
  - ChatShell: `AiHeader` 제거. 바깥 `div`는 `flex min-h-[calc(100dvh-3.5rem)]`. 모바일 전용 상단 바:
    ```tsx
    <div className="flex h-11 items-center gap-2 border-b border-border-control px-2 lg:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} className="rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-primary-500">☰ {t('ChatShell.openConversations')}</button>
        <span className="truncate text-sm text-secondary-300">{activeTitle}</span>
    </div>
    ```
    (`activeTitle` = `conversations.find(c => c.id === stream.conversationId)?.title ?? ''`). vaul `Drawer.Content`는 `z-[60]`(헤더 `z-50` 위).
  - `loginHref` 이동, `EmptyState`·ChatShell 401 바운스는 새 경로 import.
- [ ] **Step 3: 게이트(+ `yarn i18n:extract --write`, 번역) + E2E 로컬 1회**(`yarn e2e e2e/specs/agent-chat.spec.ts` — 없으면 `npx playwright test e2e/specs/agent-chat.spec.ts`; 로컬 postgres 5433 필요)
- [ ] **Step 4: 커밋** — `feat(ai): ai 호스트가 메인 헤더를 공유(테마·언어·계정 메뉴 포함)`

---

### Task S4: core 1.2.0 + AI 제안

**선행:** core v1.2.0 발행 확인(컨트롤러가 알린다). `package.json`의 `@y0ngha/siglens-core`를 `1.2.0`으로, `yarn install`, `yarn.lock` 갱신.

**Files:**
- Create: `src/entities/agent-suggestions/{model.ts,api.ts,index.ts}`, `src/entities/agent-suggestions/lib/cacheKey.ts`, `src/entities/agent-suggestions/__tests__/{api.test.ts,cacheKey.test.ts}`
- Modify: `src/app/ai/[locale]/page.tsx`, `src/widgets/agent-chat/ChatShell.tsx`(`suggestions: readonly string[] | null` prop), `EmptyState.tsx`, `src/entities/CLAUDE.md`(barrel 제외 표에 `agent-suggestions`의 `api.ts` 추가)
- Test: `EmptyState.test.tsx`(prop 우선·폴백), `ChatShell.test.tsx`

- [ ] **Step 1: 실패 테스트(api)** — 프로바이더·Redis·뉴스 조회를 mock:
  - 캐시 적중 → 프로바이더 미호출, 캐시값 반환.
  - 미스 → 프로바이더 1회, `parseSuggestions` 결과 저장(`set key value EX 3600`), 반환.
  - 파싱 결과 3개 미만 → `null`, 저장 안 함.
  - 프로바이더 throw/타임아웃 → `null`.
  - 동시 호출 2회(같은 키) → 프로바이더 1회(in-flight 합침).
  - `AGENT_CHAT_DISABLED=1` → 프로바이더 미호출, `null`.
  - Redis 없음(`getRedisClient()` null) → 캐시 없이 호출, 반환.
  - 키: `ai:suggest:v1:{SUGGESTIONS_PROMPT_VERSION}:{locale}:{YYYYMMDDHH}` / `…:u:{userId}` (보유종목 있을 때만).
- [ ] **Step 2: 구현 골격**

```ts
// api.ts
import 'server-only';
import { buildSuggestionsPrompt, parseSuggestions, SUGGESTION_COUNT, SUGGESTIONS_PROMPT_VERSION, getEtSessionStatus /* 기존 헬퍼 이름 확인 */ } from '@y0ngha/siglens-core';
import { getAgentProvider, AGENT_MODEL } from '@/entities/llm-provider/api/agent'; // 실제 노출 경로 확인(barrel 제외 표)
import { getRedisClient } from '@/shared/cache/redisClient';

const TTL_SECONDS = 3600;
const TIMEOUT_MS = 8_000;
const MIN_USABLE = 3;
// ponytail: 프로세스 내 in-flight 합침만. 인스턴스 간 스탬피드는 시간당 로케일 4개라 무시.
const inFlight = new Map<string, Promise<string[] | null>>();

export async function getAgentSuggestions(input: { locale: Locale; userId: string; portfolioSymbols: readonly string[] }): Promise<string[] | null> {
    if (process.env.AGENT_CHAT_DISABLED === '1') return null;
    const key = suggestionsCacheKey({ ...input, now: new Date() });
    const redis = getRedisClient();
    const cached = redis ? await redis.get<string[]>(key).catch(() => null) : null;
    if (cached && cached.length >= MIN_USABLE) return cached;
    const pending = inFlight.get(key);
    if (pending) return pending;
    const task = generate(input, key, redis).finally(() => inFlight.delete(key));
    inFlight.set(key, task);
    return task;
}
```
  `generate`: 헤드라인(`entities/news-article/api`의 목록 조회 — general+stock, 48h, 8건; 실패 시 빈 배열) → `buildSuggestionsPrompt` → `getAgentProvider()({ model: AGENT_MODEL, system, messages: [{ role: 'user', content: user }], tools: [], maxOutputTokens: 400, signal: AbortSignal.timeout(TIMEOUT_MS), onEvent: () => {} })` → `parseSuggestions(result.text)` → 길이 < 3이면 `null` → Redis `set(key, list, { ex: TTL_SECONDS })`. 모든 에러는 `console.warn('[agent-suggestions] failed:', error.name)`(메시지 금지) 후 `null`. `CallAgentProviderOptions`의 정확한 필드는 core 타입을 읽고 맞춘다.
- [ ] **Step 3: page.tsx** — `const suggestions = user ? await getAgentSuggestions({ locale, userId: user.id, portfolioSymbols }) : null;` (보유종목은 `DrizzlePortfolioRepository`로, stream/route.ts와 같은 방식). `ChatShell suggestions={suggestions}`.
- [ ] **Step 4: EmptyState** — `suggestions?.length ? suggestions : 정적 6개`.
- [ ] **Step 5: 게이트 + 커밋** — `feat(ai): 첫 화면 제안 질문을 AI 생성(로케일 1h 캐시·보유종목 개인화)`

---

### Task S5: Composer 재구성

**Files:** `src/widgets/agent-chat/Composer.tsx`, `__tests__/Composer.test.tsx`

- [ ] **Step 1: 실패 테스트** — 전송 버튼 `aria-label`(i18n), 버튼과 textarea 둘 다 `min-h-11` 클래스, 스트리밍 중엔 정지 버튼만, 빈 입력이면 `disabled` + `disabled:opacity` 미사용, Enter 전송·Shift+Enter 유지·IME 조합 중 무시(기존 테스트 유지).
- [ ] **Step 2: 구현** — 단일 표면:

```tsx
<div className="mx-auto w-full max-w-3xl rounded-xl border border-border-control bg-secondary-800 focus-within:ring-2 focus-within:ring-primary-500">
    <div className="flex items-end gap-1 p-1.5">
        <textarea … className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-sm text-secondary-100 placeholder:text-secondary-400 focus-visible:outline-none" />
        {streaming ? <StopButton/> : <SendButton/>}  // 둘 다 `flex h-11 w-11 shrink-0 items-center justify-center rounded-lg`, 아이콘은 인라인 SVG(↑ / ■) + aria-label
    </div>
</div>
```
  비활성 전송: `bg-secondary-700 text-secondary-400`(불투명 토큰). 활성: `bg-primary-600 text-white`. 표면 밖 하단 줄(글자수·남은 턴)은 유지, `text-xs text-secondary-400`.
  포커스 링을 표면(`focus-within`)에 두었으므로 textarea 자체의 링은 제거 — `focusIndicatorGuard`가 textarea를 요구하면 textarea에 `focus-visible:ring-2` 유지하고 표면 링은 뺀다(가드가 답).
- [ ] **Step 3: 게이트 + 커밋** — `feat(ai): Composer를 단일 표면·아이콘 전송 버튼으로 재구성`

---

### Task S6: 메시지·툴 활동·빈 화면·에러 디자인

**Skills first:** `frontend-design` → `web-design-guidelines`. 레퍼런스: ChatGPT/Claude 대화 화면 문법(assistant 비버블, user 우측 버블, 접힌 도구 단계, 중앙 컬럼).

**Files:** `MessageList.tsx`, `ToolActivity.tsx`, `EmptyState.tsx`, `ChatShell.tsx`(에러 카드), `AgentMarkdown.tsx`(타이포 클래스만), 관련 테스트

- [ ] **Step 1: 실패 테스트** — ToolActivity: 요약 버튼 텍스트 `도구 3개 사용 · 3.2s`(i18n plural), `aria-expanded`, 클릭 시 칩 3개; 실행 중 요약에 pulse 클래스. MessageList: assistant `article`에 `SiglensAI` 마크, user 버블 `max-w-[80%]`, 액션 버튼은 DOM에 항상 존재(hover 노출은 클래스). EmptyState: 제안 6개 `button` + 헤드라인. ChatShell 에러 카드에 `role="alert"` 유지 + 재시도.
- [ ] **Step 2: 구현 요점**
  - MessageList: 컬럼 `mx-auto w-full max-w-3xl px-4 py-8 gap-8`. assistant: 좌측 `size-6 rounded-full bg-primary-600 text-[10px] font-semibold text-white` 마크 "AI" + 본문(`text-[15px] leading-7 text-secondary-100`). user: `self-end max-w-[80%] rounded-2xl bg-secondary-800 px-4 py-2.5`(반경 가드가 `rounded-2xl`을 막으면 `rounded-lg`). 액션 줄 `opacity-0 group-hover:opacity-100 focus-within:opacity-100`(비활성 표현이 아니라 노출 제어 — `disabledOpacityGuard`는 `disabled:opacity`만 본다).
  - 스트리밍 자리표시 `…` 대신 점 세 개 pulse(`aria-hidden`) + `sr-only` "답변 생성 중".
  - ToolActivity: 접힘 기본, `<button aria-expanded>` 요약 → `<ul>` 칩. 결과 `<pre className="max-h-48 …">`.
  - EmptyState: `h1` `text-3xl font-semibold tracking-tight text-secondary-100`, 설명 `text-secondary-300`, 카드 `grid gap-2 sm:grid-cols-2`, 카드 클래스는 `SURFACE_CARD` + `text-left px-4 py-3 hover:bg-secondary-800/80`(알파는 그래픽 가드 확인).
  - 에러 카드: `mx-auto w-full max-w-3xl rounded-lg border border-ui-danger bg-ui-danger/10 px-4 py-3 text-sm text-ui-danger-text`(토큰명은 `globals.css`에서 확정).
- [ ] **Step 3: i18n extract + 번역, 게이트, react-doctor**
- [ ] **Step 4: 커밋** — `feat(ai): 대화·도구 활동·빈 화면·에러를 릴리즈 디자인으로`

---

### Task S7: 사이드바 그룹화 + 로딩 스켈레톤

**Files:** `src/features/agent-chat/lib/groupConversationsByDay.ts`(+test), `src/widgets/agent-chat/Sidebar.tsx`(+test), `src/app/ai/[locale]/c/[id]/loading.tsx`, `src/app/ai/[locale]/loading.tsx`

- [ ] **Step 1: 실패 테스트** — `groupConversationsByDay(items, now)` → `[{ key: 'today'|'yesterday'|'week'|'older', items }]` 빈 그룹 생략, `updatedAt` 내림차순 유지. Sidebar: 그룹 헤딩(i18n) 렌더, 활성 항목 `aria-current="page"`, "새 대화" 링크 `href` 로케일 루트.
- [ ] **Step 2: 구현** — 순수 함수는 features/lib. Sidebar 상단 "새 대화"(`rounded-lg border border-border-control … min-h-11`), 그룹 헤딩 `LABEL_KO` 계열 `text-xs text-secondary-400 px-2 pt-4 pb-1`, 항목 `rounded-lg px-2 py-2 hover:bg-secondary-800`, 활성 `bg-secondary-800 text-secondary-100`. 이름변경·삭제 버튼은 `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` + 항상 탭 가능.
  loading.tsx: 사이드바 항목 5개·메시지 3줄 `animate-pulse bg-secondary-800 rounded` 블록, `aria-busy`.
- [ ] **Step 3: 게이트 + 커밋** — `feat(ai): 사이드바 날짜 그룹·새 대화·로딩 스켈레톤`

---

### Task S8: 통합 검증(컨트롤러 직접)

- [ ] 로컬 dev 기동(env 격리 레시피, 실제 DeepSeek 키 주입) → Chrome으로 `ai.localhost:4300` 로그인 후: 빈 화면 제안 6개(AI 생성) → 클릭 → 스트림 완주 → 답변에 `get_` 문자열 없음 → 사이드바 그룹 → 이름변경/삭제 → 모바일 폭(400px) 드로어 → 라이트/다크 × 페이지/카드 대비 측정(canvas 해석, reload 방식).
- [ ] 메인 `localhost:4300` 헤더의 SiglensAI 링크 → ai 호스트 이동, ai 헤더의 `/market` 링크 → 메인 호스트 이동, 검색 선택 → 메인 심볼 페이지.
- [ ] 결함은 태스크별 수정 서브에이전트 → 리뷰 → 커밋.
- [ ] 최종 리뷰 서브에이전트(전체 diff vs `feat/agent-chat`) → PR 생성(base `feat/agent-chat`, 스택 명시) → CI·e2e·react-doctor·claude-review 통과·APPROVED, Suggestion까지 반영.
