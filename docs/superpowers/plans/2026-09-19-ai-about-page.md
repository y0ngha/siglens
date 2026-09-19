# ai.siglens.io/about Implementation Plan

> **For agentic workers:** 이 계획은 메인 세션이 인라인으로 실행한다(CLAUDE.md: 오케스트레이터가 직접 구현, 리뷰는 review-agent). 스텝은 체크박스로 추적한다.

**Goal:** ai.siglens.io 첫 화면의 소개 섹션을 새 `/about` 페이지로 옮긴다. `/about`은 승인된 프로토타입 v6(대화 재생, 불편→해결, 데이터 8칸, FAQ 8개)으로 만든다.

**Architecture:** 라우트는 `app/ai/[locale]/about`이다. 서버 컴포넌트인 `views/ai-about/AiAboutPage`가 `views.ai-about` 네임스페이스 문구를 풀어 섹션을 조립한다. 클라이언트 컴포넌트는 두 개뿐이다. `ChatReplay`(재생 상태 머신)는 순수 모듈 `replayScript`의 타임라인을 따르고, `AboutCtaBar`는 상단 고정 바다. 문구는 모두 props로 내려보내므로 클라이언트 메시지 네임스페이스는 바꾸지 않는다.

**Tech Stack:** Next.js App Router(RSC), next-intl, Tailwind v4 토큰, Vitest + Testing Library, Playwright(e2e).

설계: `docs/superpowers/specs/2026-09-19-ai-about-page-design.md`

---

## 파일 맵

| 파일 | 상태 | 책임 |
|---|---|---|
| `src/views/ai-about/lib/replayScript.ts` | 신규 | 타입, `parseReplayLine`, `sliceSegments`, `buildTimeline`, `pickNextIndex` |
| `src/views/ai-about/lib/__tests__/replayScript.test.ts` | 신규 | 순수 함수 테스트 |
| `src/views/ai-about/ui/ChatReplay.tsx` | 신규 | 재생 UI(클라이언트) |
| `src/views/ai-about/ui/__tests__/ChatReplay.test.tsx` | 신규 | SSR 초기 프레임, reduced-motion, 일시정지 |
| `src/views/ai-about/ui/AboutCtaBar.tsx` | 신규 | 고정 CTA 바(클라이언트) |
| `src/views/ai-about/AiAboutPage.tsx` | 신규 | 서버 조립, FAQ 배열 export |
| `src/views/ai-about/__tests__/AiAboutPage.test.tsx` | 신규 | 섹션·FAQ·링크 렌더 |
| `src/views/ai-about/index.ts` | 신규 | 배럴 |
| `src/app/ai/[locale]/about/page.tsx` | 신규 | 라우트, 메타, JSON-LD |
| `src/app/ai/[locale]/aiSeo.ts` (+test) | 수정 | `aiUrl`, `buildAiAboutMetadata` |
| `src/proxy.ts` (+`proxy.aiHost.test.ts`) | 수정 | sitemap에 `/about` |
| `src/widgets/agent-chat/EmptyState.tsx` (+test) | 수정 | `AiLanding` 제거, about 링크, "최신 시세" |
| `src/widgets/agent-chat/AiLanding.tsx` | 삭제 | |
| `src/widgets/agent-chat/index.ts` | 수정 | 아이콘 재수출 |
| `messages/*.json`, `messages/_meta/*` | 수정 | 추출, 번역 |
| `e2e/specs/agent-chat.spec.ts` | 수정 | `/about` SEO, sitemap |

## Task 1: replayScript (순수 모듈, TDD)

**인터페이스:**

```ts
export type SegmentTone = 'plain' | 'strong' | 'up' | 'down';
export interface Segment { readonly text: string; readonly tone: SegmentTone }
export interface ReplayLine { readonly kind: 'p' | 'li'; readonly segments: readonly Segment[] }
export interface ReplayTool { readonly label: string; readonly subject: string; readonly ms: number }
export interface ReplayScenario {
    readonly id: string;
    readonly question: string;
    readonly tools: readonly ReplayTool[];
    readonly lines: readonly ReplayLine[];
    readonly sources: readonly string[];
    readonly asOf: string;
}
/** `<b>..</b>`, `<up>..</up>`, `<down>..</down>` → segments. 알 수 없는 태그는 글자로 남긴다. */
export function parseReplayLine(kind: 'p' | 'li', raw: string): ReplayLine;
/** 앞에서부터 n글자만 남긴 segments(스트리밍 부분 렌더). */
export function sliceSegments(segments: readonly Segment[], n: number): Segment[];
export function lineLength(line: ReplayLine): number;
/** 직전 인덱스와 다른 무작위 인덱스. length 1이면 0. `random`은 주입(테스트). */
export function pickNextIndex(length: number, prev: number, random?: () => number): number;
```

**테스트(작성 후 실패 확인 → 구현 → 통과):**
- `parseReplayLine('p', '종가 <b>71,800원</b>, <up>+1.3%</up>')`: plain / strong / plain / up 네 조각.
- 태그 없는 문자열은 plain 한 조각이다. 닫히지 않은 `<b>`는 글자 그대로 plain으로 남는다.
- `sliceSegments`: 경계 중간 절단, n=0이면 `[]`, n≥전체 길이면 원본과 같다.
- `pickNextIndex`: length 1이면 0. `random=()=>0`, prev=0이면 0이 아니다. 1000회 반복해도 prev와 같은 값이 나오지 않는다.

실행: `yarn test src/views/ai-about/lib`

## Task 2: ChatReplay (클라이언트)

Props: `{ scenarios: ReplayScenario[]; labels: { pause; resume; regionLabel; checked; seconds; sourcesLabel; asOfLabel; checking } }`

동작:
- 초기 렌더(SSR 포함)는 `scenarios[0]`의 완성 상태다. 크롤러와 첫 프레임이 이 화면을 받는다.
- 마운트 후 `matchMedia('(prefers-reduced-motion: reduce)')`가 참이면 정지 상태로 둔다. 아니면 재생 루프를 시작한다.
- 루프는 `useEffect` 안의 async 함수다. `cancelled` 플래그를 두고, 기다리기는 `setTimeout` 기반 `wait`로 한다. 일시정지 중이거나 카드가 화면 밖(IntersectionObserver)이면 시간을 흘려보내지 않는다.
- 단계: 0.3초 대기 → 말풍선에 질문 타이핑(38ms ±40%) → 조회 칩을 순서대로(대기 중/완료) → 요약 한 줄 → 답변 스트리밍(3글자/28ms) → 출처 → 5.2초 대기 → `pickNextIndex`.
- 스레드 높이는 고정(`h-[420px] max-sm:h-[520px]`), 상단 정렬이다. 넘치면 스크롤을 맨 아래로 따라간다.
- 스레드는 `aria-live="off"`다. 영역 이름은 `aria-label`로 붙이고, 일시정지 버튼은 `aria-pressed`로 상태를 알린다.

**테스트:**
- 첫 렌더에 첫 시나리오의 질문, 답변 텍스트, 출처가 보인다.
- reduced-motion(matchMedia mock true)이면 타이머를 흘려도(fake timers) 텍스트가 바뀌지 않고, 일시정지 버튼이 없다.
- fake timers로 1초를 흘리면 질문이 부분 타이핑된 상태가 된다(말풍선 텍스트 길이가 질문보다 짧다).
- 일시정지 버튼을 누르면 `aria-pressed=true`가 되고, 시간을 흘려도 말풍선 텍스트가 그대로다.

## Task 3: AboutCtaBar (클라이언트)

`useHideOnScrollDown({ enabled: true })`를 쓴다. 숨김이면 `top-0`, 아니면 `top-14`다. 스크롤 8px을 넘으면 그림자를 켠다. 렌더 테스트 1개로 제목 텍스트와 링크 href를 확인한다.

## Task 4: AiAboutPage (서버) + 문구

- `getTranslations({ locale, namespace: 'views.ai-about' })`로 문구를 풀고, 시나리오 5개를 `parseReplayLine(t.raw(...))`로 만든다. 모든 호출은 정적 키 리터럴로 쓴다(추출기 보존 조건).
- FAQ 배열은 `buildAboutFaq(t)`로 한 번만 만들고 `AiAboutPage`와 `page.tsx`(JSON-LD)가 같이 쓴다.
- 섹션: CTA 바 → 히어로 → 재생 → 불편 5줄 → 데이터 흐름(8칸, `widgets/agent-chat` 아이콘) → FAQ(`<details>`) → SIGLENS 더 보기 링크 → 마지막 CTA → 면책 문구.
- `messages/ko.json`에 `views.ai-about.*` 키를 추가한다(값은 프로토타입 v6 문구).

**테스트:** h1, h2 5개("이런 점이 답답했다면", "답하기 전에 이런 걸 찾아봐요", "자주 묻는 질문", …), FAQ 질문 8개, CTA 링크 href(`/` + localePrefix), `buildAboutFaq`가 화면 FAQ와 같은 배열인지.

## Task 5: 라우트·SEO·sitemap

- `aiSeo.ts`: `aiUrl(locale, path)`를 추가한다. `aiHomeUrl`은 이걸 쓰게 바꾼다. `buildAiAboutMetadata(locale, copy)`는 canonical `/about`, hreflang, 인덱스 게이트를 넣는다. 테스트도 추가한다.
- `page.tsx`: `setRequestLocale`, `generateMetadata`, `<JsonLd data={buildFaqJsonLd(faq)} />`, `<AiAboutPage />`.
- `proxy.ts`의 `aiSitemapXml`에 `/about`을 추가하고 `proxy.aiHost.test.ts` 기대값을 추가한다.

## Task 6: 루트 정리

- `EmptyState`: `<AiLanding>`를 빼고 about 링크(`${localePrefix}/about`, 같은 호스트)를 넣는다. `capQuotes` 값을 "최신 시세"로 바꾼다.
- `AiLanding.tsx`를 삭제한다. `EmptyState.test.tsx`의 랜딩 섹션 테스트는 about 링크 테스트로 바꾸고, "실시간 시세" 단언은 "최신 시세"로 바꾼다.

## Task 7: i18n

1. `yarn i18n:extract --write`: ko 카탈로그를 재생성한다. `Landing.*`가 제거되고 `views.ai-about.*`가 유지되는지 `git diff messages/ko.json`으로 확인한다.
2. `yarn i18n:translate --locale en`, `ja`, `zh`를 각각 실행한다.
3. `yarn i18n:verify`, `yarn i18n:lint`를 실행한다.

## Task 8: e2e

`agent-chat.spec.ts` SEO 블록에 두 가지를 넣는다. `/about` 200, index/follow, canonical `${AI}/about`, `"@type":"FAQPage"`, h1이 있는지. sitemap에 `<loc>${AI}/about</loc>`가 있는지.

## Task 9: 게이트

- `yarn typecheck`, `yarn lint`(경고 수 확인), 스코프 테스트, `yarn test:related`
- 전체 스위트 1회: `yarn test:quiet > /tmp/…/full.log`
- 로컬 dev에서 `curl -s -H 'Host: ai.localhost' …/about`으로 SSR 본문, canonical, JSON-LD를 확인한다.
- review-agent → mistake-managing-agent → git-agent (CLAUDE.md 라우팅)
