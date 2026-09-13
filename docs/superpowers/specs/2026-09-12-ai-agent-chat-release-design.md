# SiglensAI 릴리즈 마감 — 공유 헤더·AI 제안·출처 표기·릴리즈 디자인 설계

> 기반: `docs/superpowers/specs/2026-09-11-ai-siglens-agent-chat-design.md`(v2.2, PR #803).
> 이 문서는 파일럿(PR #802) 위에 스택되는 후속 PR 한 쌍(core v1.2.0 + siglens `feat/agent-chat-release`)의 설계다.

## 1. 요구사항 → 결정

| # | 요구 | 결정 | 근거 |
|---|---|---|---|
| R1 | 메인 헤더에서 AI로 이동 | 데스크톱 내비 끝 + 모바일 드로어에 "SiglensAI" 강조 링크(`AI_SITE_URL` + 로케일 경로) | NAV_TREE는 자산군×지역 뼈대라 AI는 버티컬이 아니다. 별도 링크 하나가 트리를 안 건드린다 |
| R2 | ai 호스트도 같은 헤더(테마·다국어 포함) | 메인 `Header`를 그대로 렌더 + **호스트 인식 링크 베이스**(`LocaleProvider.hrefBase`) | 두 헤더를 유지하면 갈린다. 링크만 절대 URL로 바꾸면 컴포넌트·테스트·i18n 전부 재사용 |
| R3 | 제안 질문을 AI로 생성 | core `buildSuggestionsPrompt`/`parseSuggestions` + siglens `entities/agent-suggestions`, Redis 1h 캐시(로케일, 보유종목 있으면 사용자 키) | 프롬프트 빌더는 core 영역(SCOPE §0). 캐시로 로케일당 시간당 1콜 |
| R4 | 전송 버튼·입력창 높이 일치 | Composer를 단일 표면(`rounded-xl`)으로 재구성, 버튼 `h-11` = textarea `min-h-11` | GPT/Claude 문법 |
| R5 | 답변에 `get_news()` 같은 내부 이름 노출 | core 시스템 프롬프트 Output 규칙 교체: 툴 이름·함수 호출 구문 금지, "siglens 시세/뉴스/분석/옵션/보유종목/웹 검색"으로 표기 + asOf | 원인은 미호출이 아니라 "e.g. source get_quote" 인용 지시. 로컬 뉴스 부재는 E2E 픽스처 DB 한정 |
| R6 | 릴리즈 수준 디자인 | siglens 토큰 유지(스펙 R11), GPT/Claude 레이아웃 문법 채택 | 별도 브랜드색 금지. Aperture는 범위 밖 |

## 2. PR 스택

1. **siglens-core `feat/agent-suggestions` → v1.2.0**: R3 프롬프트/파서, R5 프롬프트 규칙, `AGENT_PROMPT_VERSION` bump.
2. **siglens `feat/agent-chat-release`** (base `feat/agent-chat`, PR #802): core 1.2.0 소비 + R1·R2·R3·R4·R6.

#802가 먼저 머지되면 base를 master로 바꾼다(스택 PR 관례).

## 3. core

### 3-1. `domain/agent/promptShared.ts`
`LANGUAGE_NAME`, `formatClock`를 `buildAgentSystemPrompt.ts`에서 추출(두 프롬프트가 공유).

### 3-2. Output 규칙(`buildAgentSystemPrompt.ts`)
```
- Cite the data source and its asOf time in plain words, in the answer language (Korean example: "(출처: siglens 시세, 2026-09-12 08:57 ET 기준)").
- Never write internal tool names (get_quote, get_news, run_fresh_analysis, …) or function-call syntax in the answer. Call them siglens quotes / bars & indicators / analysis / news / options / portfolio / web search in the answer language.
```
`AGENT_PROMPT_VERSION = '2026-09-12.3'`.

### 3-3. `domain/agent/buildSuggestionsPrompt.ts`
```ts
export interface SuggestionHeadline { title: string; symbol?: string; category?: string; publishedAt: Date }
export interface BuildSuggestionsPromptInput {
    locale: Locale; now: Date; etSessionStatus: EtSessionStatus;
    headlines: readonly SuggestionHeadline[];      // ≤ 8, 최신순
    portfolioSymbols?: readonly string[];           // 있으면 2개는 보유종목 기반
    count?: number;                                 // 기본 SUGGESTION_COUNT
}
export const SUGGESTIONS_PROMPT_VERSION = '2026-09-12.1';
export const SUGGESTION_COUNT = 6;
export const SUGGESTION_MAX_CHARS = 60;
export function buildSuggestionsPrompt(input): { system: string; user: string };
export function parseSuggestions(raw: string, o?: { count?: number; maxChars?: number }): string[];
```
- system: 역할(siglens 시장 도우미 첫 화면의 제안 질문 작성자), 언어, 규칙(사용자 1인칭 질문체, 투자 권유 금지, 가격·수치 인용 금지, 한 줄 ≤ `maxChars`, 서로 다른 주제, 보유종목이 있으면 그중 2개는 보유종목, 나머지는 헤드라인·장 상태 기반), 출력 = **JSON 문자열 배열만**.
- user: 현재 시각(ET/KST)·장 상태·헤드라인 목록·보유종목.
- `parseSuggestions`: ```json 펜스 제거 → `JSON.parse` → 배열이 아니면 `[]` → 문자열만 → trim → 빈/초과 길이 제거 → 대소문자 무시 중복 제거 → `count`개. 예외는 `[]`.

### 3-4. 테스트
`src/__tests__/domain/agent/buildSuggestionsPrompt.test.ts`(프롬프트 문장·헤드라인 주입·보유종목 분기·파서 정상/펜스/비배열/길이/중복/예외), `buildAgentSystemPrompt.test.ts` 갱신(신규 문장 포함, `source get_quote` 부재).

## 4. siglens

### 4-1. 호스트 인식 링크(R2)
- `shared/i18n/LocaleContext.tsx`: `LocaleProvider({ locale, hrefBase = '' })`, `useHrefBase(): string`.
- `shared/ui/LocaleLink.tsx`: `href`가 `/`로 시작하면 `${hrefBase}${localePath(...)}`. 베이스가 있으면 다른 오리진이라 `next/link`가 전체 내비게이션을 한다(의도).
- 검색 이동 2곳(`features/ticker-search/hooks/useAutocomplete.ts`의 `router.push`, `SearchOverlayProvider`의 `router.replace`): 베이스가 있으면 `window.location.assign(base + path)`.
- `Header`에 `authNext?: string` → `HeaderUserMenu`·`HeaderMobileMenu`의 로그인/가입 href에 `?next=` 부착. ai 레이아웃은 `'/api/auth/handoff?to=ai&next=%2F'`를 넘긴다(§9-4 핸드오프; 비로그인은 `/c/*`가 404라 `/` 복귀로 충분).
- ai 레이아웃(`app/ai/[locale]/layout.tsx`): `LocaleProvider hrefBase={SITE_URL}` + `SearchOverlayProvider` + `<AuthSessionHeaderClient authNext=… />`. `AiHeader.tsx` 삭제, `loginHref`는 `widgets/agent-chat/loginHref.ts`로 이동.
- `HeaderUserMenu`의 로그아웃은 `logoutAction` 그대로(호스트별 세션만 지움, 스펙 §9-4).

### 4-2. AI 진입점(R1)
- `HeaderNav`·`HeaderNavStatic`·`HeaderMobileMenu`에 `AiNavLink`(`widgets/layout/AiNavLink.tsx`): `href = AI_SITE_URL + localePath(locale, '/')`, 라벨 "SiglensAI"(`translate="no"`), 스타일은 primary 틴트 필 — 텍스트 4.5:1·경계 3:1 가드 통과 토큰만. `hrefBase`가 설정된 곳(=ai 호스트)에서는 `aria-current="page"` 활성.

### 4-3. AI 제안(R3)
- `entities/agent-suggestions/`: `model.ts`(타입), `api.ts`(`server-only`): `getAgentSuggestions({ locale, userId, portfolioSymbols }): Promise<string[] | null>`.
  - 입력: 최신 헤드라인 ≤ 8(`entities/news-article/api`의 목록 조회, 카테고리 general+stock, 최근 48h), `getEtSessionStatus`(기존 core 헬퍼), 보유종목.
  - 프로바이더: `getAgentProvider()`(E2E는 fake → 파서 `[]` → 폴백), `tools: []`, `maxOutputTokens: 400`, `AbortSignal.timeout(8_000)`.
  - 캐시: `getRedisClient()`; 키 `ai:suggest:v1:{locale}:{YYYYMMDDHH}`(TTL 3600) / 보유종목 있으면 `…:u:{userId}`. 프로세스 내 in-flight `Map<string, Promise>`로 동시 요청 합침. Redis 없으면 캐시 없이 호출.
  - 실패·`AGENT_CHAT_DISABLED=1`·파싱 3개 미만 → `null`.
- `app/ai/[locale]/page.tsx`: 로그인 사용자만 조회, `ChatShell suggestions` prop → `EmptyState`는 `suggestions ?? 정적 6개`.

### 4-4. Composer(R4)
단일 `rounded-xl border-border-control bg-secondary-800` 표면 안에 textarea(투명 배경, `min-h-11`) + 우측 하단 아이콘 전송 버튼(`h-11 w-11` 미만이면 `min-h-11 min-w-11`, `aria-label`) / 스트리밍 중 정지 버튼(같은 자리). 글자수·남은 턴은 표면 아래 작은 줄. Enter 전송·Shift+Enter 줄바꿈·IME 유지.

### 4-5. 릴리즈 디자인(R6) — GPT/Claude 문법, siglens 토큰
- 구조: 공유 헤더(sticky, 56px) 아래 `min-h-[calc(100dvh-3.5rem)]` 2컬럼. 사이드바 `w-64` 데스크톱 고정(`lg:`), 모바일은 vaul 드로어(`z-[60]`, 헤더 위). 모바일 상단에 얇은 바("☰ 대화 목록" + 현재 대화 제목).
- 사이드바: "새 대화" 버튼 상단, 대화는 오늘/어제/지난 7일/이전 그룹(`groupConversationsByDay`, 순수 함수+테스트), 활성 항목 `bg-secondary-800`, hover/focus 시 이름변경·삭제 아이콘. 삭제 확인 인라인 유지.
- 메시지: assistant는 버블 없이 본문(`prose` 톤, `max-w-none`), 좌상단 작은 "SiglensAI" 마크. user는 우측 `bg-secondary-800` 버블 `max-w-[80%]`. 액션(복사·재생성·수정)은 hover/focus 시 노출, 항상 키보드 접근 가능.
- 툴 활동: 한 줄 요약 버튼("도구 3개 사용 · 3.2s", 실행 중엔 pulse) → 펼치면 칩 목록(기존). 결과 `<pre>`는 `max-h-48 overflow-auto`.
- 빈 화면: 인사 헤드라인(`HEADING_SECTION` 계열, 시간대 인사 없음), 한 줄 설명, 제안 카드 2열(`SURFACE_CARD` 톤, 좌측 정렬, 아이콘 없음), 비로그인은 로그인 CTA.
- 에러: 대화 하단 카드(`border-ui-danger` 계열 토큰, 텍스트 `text-ui-danger-text`) + 재시도 버튼. `role="alert"` 유지.
- 로딩: `app/ai/[locale]/c/[id]/loading.tsx` 스켈레톤(사이드바·메시지 3줄).
- 라이트 테마: 네 조합(두 테마 × 페이지/카드 배경) Chrome 실측(DESIGN.md §재는 법). 새 토큰 없음이 목표.
- 접근성: 포커스 링 `focus-visible:ring-2 ring-primary-500` 전 조작 요소, `disabled:opacity-*` 금지, 반경 3단계.

### 4-6. i18n
새 문구는 `t()`로 작성 → `yarn i18n:extract --write` → en/ja/zh 번역 채움 → `scripts/i18n/verify.mjs`. 브랜드명(SiglensAI)은 번역하지 않는다.

### 4-7. 테스트
- 유닛: `LocaleLink`(베이스 유/무), `LocaleContext`, `useAutocomplete` 베이스 분기, `Header`/`HeaderNav`/`HeaderMobileMenu`(AI 링크·authNext), `agent-suggestions`(캐시 적중/미스/폴백/타임아웃/in-flight 합침/kill switch), `groupConversationsByDay`, `Composer`(높이 클래스·전송/정지 전환), `ToolActivity`(접힘/펼침), `EmptyState`(제안 prop 우선), `ChatShell`(헤더 제거 후 렌더).
- 가드: `src/__tests__/guards`, `src/shared/ui/__tests__` 전체.
- E2E(`e2e/specs/agent-chat.spec.ts`): ai 호스트에 `banner` 랜드마크 + "SiglensAI" 활성 링크 + 테마 토글 존재, 메인 헤더에 "SiglensAI" 링크 href가 ai 호스트, 빈 화면 제안 6개(폴백) 렌더, 기존 3개 유지.
- React Doctor 로컬 재현 0 error.

## 5. 비목표
Aperture 리디자인, 모델 선택, 제안의 클릭률 측정, 사이드바 검색.
