# [symbol] 분석 결과 공유 기능 설계 (이슈 #367)

- 상태: 설계 승인 대기 (R1: client-supplied 전환 + 오류 4건 / R2: frontend-design + web-design-guidelines UI·a11y / R3: register 계약·OG·rate-limit·dedupe 실측 반영)
- 작성일: 2026-06-29
- 관련 이슈: #367 `[Feature] 분석 결과 공유 기능 (SNS / 링크)`

## 0. 검증으로 폐기된 초기 가정 (반드시 참고)

fresh-context 적대적 검증 3종에서 드러난 사실. 이 설계는 아래를 전제로 한다.

1. **core `filterAnalysisResult`는 사용 불가** — public barrel 미export(`@internal`), deep import는 ESLint/CLAUDE.md 금지, 게다가 **chart `AnalysisResponse` 전용**(나머지 6개 kind용 필터 부재). → **티어 필드 마스킹은 MVP에서 구현하지 않는다**(§12 참조). 라이브 앱도 `enableTierRestrictions:false`로 현재 전 필드 노출 중이라, 공유도 동일 정책으로 일관.
2. **서버 cache peek는 chart·overall 2개 kind만 존재** (`peekAnalysisCache` / `peekOverallAnalysisCache`). news/fundamental/financials/congress/options/fear-greed는 서버 peek가 없거나(클라 compute), peek 시 외부 fetch·input-hash 미스로 부정확. → **서버 재-peek을 버리고 클라이언트가 보유한 분석 결과를 액션에 전달한다**(client-supplied).
3. 기존 `[symbol]/opengraph-image`는 `force-static` + symbol param 기반이라 opaque id 라우트에 **재사용 불가** → `/share/[id]/opengraph-image.tsx`를 dynamic으로 별도 작성.
4. 이 repo `robots.ts`는 noindex 페이지를 **의도적으로 Disallow하지 않음**(문서화된 결정) → noindex는 page metadata `robots:{index:false}`로만 처리, robots.ts는 건드리지 않는다.

## 1. 목표

사용자가 각 `[symbol]/**` 탭의 AI 분석 결과를 **공유 가능한 링크 / SNS**로 내보낸다.
공유 결과는 **로그인 없이** 조회 가능하며, 공유 시점 스냅샷을 DB에 저장해 **재분석 없이** 재현한다.

핵심 요구(사용자 확정):
- 공유 버튼은 **모든 `[symbol]/**` 탭 헤더**에 존재.
- 각 탭은 **자기 탭의 분석 결과**를 공유(차트 한정 아님, 8개 kind).
- 모바일은 **네이티브 공유 시트(바텀시트)**.
- **분석이 없을 때**: 사용자가 공유를 눌렀을 뿐이므로, 부드러운 안내 컨펌 → 동의 시 분석을 대신 실행 → 진행 중 로딩 표시 → 완료되면 자동으로 공유까지 이어준다.

## 2. 범위 — 공유 가능한 8개 kind

| kind | 결과 타입 (`@y0ngha/siglens-core`) | 클라 결과 출처(훅) | 비고 |
|---|---|---|---|
| `chart` | `AnalysisResponse` | `useAnalysis` (views/symbol) | 서버 `peekAnalysisCache` 교차검증 가능 |
| `overall` | `OverallAnalysisResponse` | `useOverallAnalysis` (widgets/overall) | 서버 `peekOverallAnalysisCache` 교차검증 가능 |
| `news` | `NewsAnalysisResponse` | `useNewsAnalysis` | |
| `fundamental` | `FundamentalAnalysisResponse` | `useFundamentalAnalysis` | |
| `financials` | `FinancialsAnalysisResponse` | `useFinancialsAnalysis` | |
| `congress` | `CongressTrendResponse` | `useCongressTrend` | `no_trades`면 `unavailable` |
| `options` | `OptionsAnalysisResponse` | `useOptionsAnalysis` | 빈 시장이면 `unavailable` |
| `fear-greed` | `FearGreedSnapshot` | `useFearGreedFromSymbol` | 결정론적 compute(트리거 불필요, 항상 `success`) |

> `tabsFor(profile)`로 일부 자산(crypto 등)은 특정 탭이 없다. ShareButton은 현재 심볼에 비-shareable kind일 수 있음을 허용한다.

## 3. 스코프 가드 (siglens vs siglens-core)

**siglens에서 진행.** core에 새 도메인 로직을 추가하지 않는다.
- §0-1에 따라 `filterAnalysisResult` 호출은 **하지 않는다**(MVP). 따라서 core 의존은 타입 import뿐.
- 스냅샷 저장·표시·공유 UI·DB·OG·라우트·트리거 UX는 전부 siglens.
- 티어 per-kind 마스킹이 향후 필요해지면 그때 core PR(per-kind filter + public export)을 **선행**해야 한다 — 본 MVP의 범위가 아니다.

## 4. 데이터 흐름 (client-supplied)

```
[모든 [symbol]/** 탭]
  현재 탭의 AI 패널/위젯이 ShareableAnalysisContext 에 자신을 등록(register):
      { kind, status, result, context, trigger }
        status ∈ idle | pending | success | error | unavailable

  SymbolLayoutHeader.tsx → <ShareButton />  (ModelSelector 옆) — context를 consume
        │ 클릭
        ▼
  [분기: 현재 등록된 status]
    success  → createShareSnapshotAction({ kind, symbol, result, context })  ── 즉시
    pending  → 로딩 모달("분석 결과를 준비하고 있어요") → success 전이되면 자동 진행
    idle/err → 부드러운 컨펌 다이얼로그 → 확인 시 trigger() → 로딩 모달 → success → 진행
    unavailable → "이 탭은 공유할 분석이 아직 없어요" 안내(공유 불가)
        ▼
  createShareSnapshotAction  ('use server')
        │ 1) rate limit (hashUsageIp 기반 IP 해시 카운터)
        │ 2) assertValidSnapshotInput(kind, result)  ← 서버측 스키마 검증(클라 신뢰 X)
        │ 3) (옵션) chart/overall은 peek 교차검증
        │ 4) buildShareSnapshot({ kind, symbol, context, result }, now)  ← 순수, Serialized 보장
        │ 5) content-hash dedupe → 기존 id 있으면 재사용, 없으면 insert (7일 expiresAt)
        ▼
  { id } → 클라가 `${SITE_URL}/share/${id}` → 모바일 navigator.share / 데스크톱 Popover

[공유 수신자]
  /share/[id]  (RSC, 공개, 동적 렌더)
    → getSharedAnalysis(id) → 만료/없음 안내
    → parseSnapshot(row) → SHARE_KIND_PANEL_REGISTRY[kind].Panel (읽기전용) + "as of {시각}" disclaimer
    → generateMetadata: OG/Twitter, robots:{index:false}
```

## 5. ShareableAnalysisContext & 공유 트리거 UX

### 5-1. Context (`features/share/` 또는 `shared/` 경계)

각 탭 위젯이 자기 분석 상태를 헤더의 ShareButton에 알리는 얇은 통로. ShareButton이 kind별 훅을 몰라도 되게 한다.

```ts
interface ShareableAnalysisRegistration<K extends ShareableKind> {
    kind: K;
    status: 'idle' | 'pending' | 'success' | 'error' | 'unavailable';
    result: SnapshotResultOf<K> | null;   // success일 때만 non-null
    context: ShareContext;                // symbol, displayName, koreanName, assetClass, analyzedAt
    trigger: () => void;                  // 분석 시작(이미 훅이 노출하는 submit 재사용)
}
```

- Provider는 `[symbol]` 레이아웃(`SymbolLayoutProviders`)에 위치. 활성 탭 위젯이 `useRegisterShareable(registration)`로 `useEffect` 등록/갱신.
- ShareButton은 `useShareable()`로 현재 등록값을 읽는다. (탭 전환 시 직전 등록은 해제.) **register 미존재 = 비-shareable kind → 버튼 unavailable 처리**(`tabsFor(profile)`로 탭이 없는 자산 자동 대응).
- 등록은 위젯이 자기 훅 결과를 `ShareableAnalysisRegistration`으로 변환하는 **어댑터**다. 훅 반환 형태가 제각각이라 **작업량이 kind별로 다르다**(검증 R3 실측):

| kind | 훅 반환(실측) | register 작업 |
|---|---|---|
| overall | `{ state(status 7값), trigger }` | **1줄** — 그대로 매핑 |
| fear-greed | `{ snapshot, history }`(deterministic, trigger 없음) | **1줄** — 항상 `success`(snapshot null이면 unavailable), trigger=noop |
| news / fundamental / financials / congress / options | `status`(4–5값, congress는 `no_trades` 포함) + `result`, **top-level trigger 없음**(error-branch `retry`만) | **moderate** — 각 훅 반환에 `trigger: () => refetch()` 추가(내부 refetch는 이미 존재) 후 위젯에서 매핑 |
| chart | `useMutation` 로컬 state, **status enum 없음**(`isAnalyzing`/`analysisError`/`isBotBlocked`/`analysisResult`), 캐시 미공유, `handleReanalyze`(쿨다운 게이트) | **hook 작업** — 위젯 어댑터에서 booleans→status 합성 + start trigger 정리. 캐시로 헤더가 관측 불가하므로 register 필수 |

- options는 `expirationDate`가 탭-로컬 선택이라 헤더가 알 수 없음 → register 방식이라야 사용자가 고른 만료일 결과가 반영됨(설계 정당성 재확인).
- FSD: context는 features/shared에 두어 widgets(각 탭)·views(헤더) 양쪽이 import 가능하게 한다. widgets↔widgets, entities↔entities cross-import 예외는 CLAUDE.md에 명시됨.

### 5-2. 트리거 UX 카피(부드럽게, 허락 구하는 톤)

- 컨펌(idle/error): 제목 "공유하기 전에 분석을 준비할게요" / 본문 "이 종목의 AI 분석이 아직 없어요. 잠깐이면 준비돼요. 계속할까요?" / 기본 버튼 "분석하고 공유하기" · 보조 "취소". **부정적·위협적 표현 금지**(시간 경고는 "잠깐", "금방" 톤).
- 로딩 모달(pending): "AI가 분석 결과를 준비하고 있어요…" + 진행 표시. 완료 시 자동으로 공유 시트로 전이.
- unavailable: "이 탭은 공유할 분석이 아직 없어요"(congress no_trades / 빈 옵션 시장).

## 6. kind 레지스트리

서버 전용과 클라 표현을 파일 분리(서버 액션과 'use client' 패널 공존 불가).

### 6-1. 서버 (`entities/shared-analysis/server/kindServerRegistry.ts`)
```ts
interface ShareKindServerEntry<R> {
    kind: ShareableKind;
    assertValidInput: (result: unknown) => asserts result is R; // 클라 전달값 스키마 검증
    buildOgText: (result: R) => { description: string; tweet: string }; // 방향성+요약, X 길이 클램프
    crossCheckPeek?: (symbol: string) => Promise<R | null>;            // chart/overall만 제공(옵션)
}
export const SHARE_KIND_SERVER_REGISTRY: { [K in ShareableKind]: ShareKindServerEntry<SnapshotResultOf<K>> };
```
- `applyTierFilter`는 **두지 않는다**(§0-1). 향후 마스킹 도입 시 이 인터페이스에 추가.
- `buildOgText`는 **kind별 구현** — 방향성/요약 추출 필드가 kind마다 다름(검증 R3 실측):

| kind | 방향성(direction) | 요약 | 비고 |
|---|---|---|---|
| chart | `trend` | `summary`(첫 줄) | |
| overall | **top-level 없음** → `scenarios[].name` 다수결 또는 `headlineKo`에서 도출 | `headlineKo` | 도출 로직 필요 |
| news | `overallSentiment` | `currentDriverKo` | |
| fundamental | `overallSentiment` | `overallConclusionKo` | |
| financials | `overallSentiment` | `overallConclusionKo` | |
| congress | `overallSentiment` | `summaryKo` | |
| options | **top-level 없음** → `signals`/per-expiration `tone`에서 도출 | `summary` | 도출 로직 필요 |
| fear-greed | `label`(EXTREME_FEAR…GREED) | `score`(0–100) | deterministic |

- tweet 텍스트는 URL 포함 길이를 테스트로 클램프.

### 6-2. 클라 (`widgets/share/kindPanelRegistry.tsx`)
```ts
export const SHARE_KIND_PANEL_REGISTRY: { [K in ShareableKind]: ReadonlyPanel<SnapshotResultOf<K>> };
```
- 각 탭의 presentational `*View({ result })` 재사용. 검증 결과 6개 kind는 이미 `*View` 보유(congress는 export됨), chart는 `AnalysisPanel({ analysis })`가 prop-fed, **overall만 신규 `OverallView({ result })` 래퍼 추출** 필요.
- MVP는 **AI 요약 패널만** 표시(raw 데이터 테이블 제외, §12).

### 6-3. kind 단일 소스
`ShareableKind`는 `as const` 배열 하나에서 enum 값·TS 타입을 함께 도출. `TABS`(symbolTabsConfig) 및 두 레지스트리와 **타입 레벨 exhaustiveness**로 묶어, 탭 추가 시 누락이 컴파일 에러가 되게 한다.

## 7. DB 스키마 (`src/shared/db/schema.ts`)

```ts
export const sharedAnalyses = pgTable('shared_analyses', {
    id: text('id').primaryKey(),                       // crypto.randomBytes → base64url (tokenUtils.ts createToken 재사용)
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // nullable(비회원)
    kind: shareableKindEnum('kind').notNull(),
    symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(), // dedupe 용(kind+symbol+result 해시)
    snapshotJson: jsonb('snapshot_json').notNull(),                 // Serialized<{ kind, symbol, context, result }>
    sharerTier: userTierEnum('sharer_tier').notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),  // created + 7일
}, (t) => [
    index('shared_analyses_symbol_idx').on(t.symbol),
    index('shared_analyses_expires_at_idx').on(t.expiresAt),        // 만료 조회/정리용
    uniqueIndex('shared_analyses_content_uq').on(t.contentHash),    // 동일 재공유 dedupe
]);
```
- `yarn db:generate`(→ `drizzle/0022_*.sql`) → `yarn db:migrate`.
- `shareableKindEnum` 값은 §6-3 단일 소스에서 `shared/db/constants` 경유로 정의.

## 8. entity slice (`src/entities/shared-analysis/`)

| 파일 | 역할 | 계층 |
|---|---|---|
| `types.ts` | `ShareableKind`, `ShareContext`, `SharedAnalysisSnapshot`(union), `SnapshotResultOf<K>`, `Serialized<R>` | 순수 |
| `lib/buildShareSnapshot.ts` | **순수** — `(input, now) → Serialized snapshot`. Date→string 보장 | 순수 |
| `lib/parseSnapshot.ts` | **순수** — DB row → 타입 안전 snapshot(경계 재하이드레이션) | 순수 |
| `lib/generateShareId.ts` | crypto base64url 토큰 | 순수(crypto) |
| `lib/contentHash.ts` | dedupe용 해시 | 순수 |
| `lib/isExpired.ts` | **순수** — `(expiresAt, now) → boolean` | 순수 |
| `server/kindServerRegistry.ts` | §6-1 | server-only |
| `api.ts` | `DrizzleSharedAnalysisRepository`(create with onConflict dedupe / findById) + `withRetry` | server-only |
| `actions/createShareSnapshotAction.ts` | rate limit → 검증 → build → persist → `{ id }` | server action |
| `actions/getSharedAnalysisAction.ts` | `/share`용 조회 + 만료 판정 | server |
| `index.ts` | barrel | — |

- rate limit(검증 R3 실측): `getClientIp()`(`x-forwarded-for` 첫 값, `entities/chat-message/api/getClientIp.ts` 재사용) → `hashUsageIp`(core) → 카운터. Upstash Redis(`shared/cache/redisClient.ts`, env 없으면 graceful null)에 일일 INCR, 또는 DB `usageLogs` count 패턴 차용(전용 INCR 프리미티브는 없음 → 둘 중 택1, Redis 우선·미설정 시 통과). server action은 `await headers()`(Next 16 async).
- `now`/만료는 action/api에서 주입.
- dedupe: `onConflictDoUpdate({ target: contentHash, set: { expiresAt: created+7일 } }).returning({ id })` — 동일 내용 재공유는 **기존 id 반환 + 만료 7일 갱신**을 단일 statement로(검증 R3, `news-article/api.ts` 패턴). `setWhere` 가드 없이 `expiresAt`을 무조건 갱신해 항상 id가 반환되게 한다.
- `snapshot_json`에 `result` + 표시 컨텍스트 + `analyzedAt`(없으면 `createdAt` fallback) 저장.

## 9. UI / UX 상세 설계 (`src/widgets/share/`)

`frontend-design` + `web-design-guidelines`(Web Interface Guidelines) 점검 반영.
이 repo는 **Radix/shadcn/lucide/sonner 미사용** — 손수 만든 hook + inline SVG + `cn()`로 구현하고
기존 컴포넌트 톤을 정확히 따른다.

### 9-0. 재사용 primitive 매핑 (신규 라이브러리 도입 금지)

| 용도 | 재사용 | 참고 구현 |
|---|---|---|
| 다이얼로그/모달 | `useDialog()` (focus-trap + escape + click-outside + trigger 포커스 복원) | `widgets/layout/ContactDialog.tsx`, `widgets/chat/UserApiKeyRequiredModal.tsx` |
| 데스크톱 팝오버 | `usePopoverToggle(refs)` + `useEscapeKey` | `widgets/layout/HeaderUserMenu.tsx`, `widgets/analysis/ModelSelector.tsx` |
| 복사 | `useCopyToClipboard()` (`{ copied, copy }`) | `widgets/analysis/AnalysisPanel.tsx` copy 버튼 |
| 모바일 시트(필요 시) | `vaul` `Drawer` + `useRestoreBodyPointerEvents()` | `views/symbol/MobileAnalysisSheet.tsx` |
| 아이콘 | inline 20×20 `fill="currentColor"` SVG | `shared/ui/EyeIcon.tsx` 하우스 스타일 |
| 클래스 합성 | `cn()` | `shared/lib/cn.ts` |

**신규 inline 아이콘**(없어서 추가): `ShareIcon`, `LinkIcon`, `CheckIcon`, `XLogoIcon`, `KakaoIcon`, `SpinnerIcon`.
색 토큰만 사용(하드코딩 hex 금지). 모든 인터랙티브 요소에 `transition-colors` + `touch-action: manipulation`.

### 9-1. `ShareButton.tsx` (`'use client'`, 헤더)

- 배치: `views/symbol/SymbolLayoutHeader.tsx` 우측 액션 `div`(`ModelSelector` 왼쪽). 모든 탭 공통 노출.
- 형태: 아이콘 버튼 —
  `inline-flex size-9 min-h-11 items-center justify-center rounded-lg border border-secondary-700 text-secondary-300 hover:border-secondary-600 hover:bg-secondary-700/30 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none transition-colors touch-manipulation`
- 시맨틱: `<button type="button" aria-label="분석 결과 공유">` + `ShareIcon`.
- 상태머신(`useShareable()` status 기반):
  - `success` → 즉시 `createShareSnapshotAction` → 결과 라우팅
  - `pending` → `SharePreparingModal` 오픈(이미 폴링 중)
  - `idle`/`error` → `ShareTriggerDialog` 오픈
  - `unavailable` → 버튼 **활성 유지**(disabled로 두지 않음 — 포커스/사유 전달 위해), 클릭 시 인라인 안내 "이 탭은 공유할 분석이 아직 없어요". `aria-describedby`로 사유 연결.
- 액션 진행 중: `aria-busy`, `SpinnerIcon`으로 스왑, 중복 클릭 방지(`disabled` while mutating). 라벨 보조 텍스트 `준비 중…`(말줄임 종결).

### 9-2. `ShareTriggerDialog.tsx` — 분석 트리거 컨펌(부드러운 톤)

- `useDialog()`: 오버레이 `bg-secondary-950/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm overscroll-contain`, 패널 `bg-secondary-800 border border-secondary-700 w-full max-w-sm rounded-xl shadow-2xl outline-none`.
- `role="dialog" aria-modal="true" aria-labelledby aria-describedby`, **기본 포커스 = 기본 CTA**, Escape/클릭아웃 닫힘, 닫으면 ShareButton로 포커스 복원.
- 카피(active voice, 2인칭, 위협적 표현 금지):
  - 제목 `공유하기 전에 분석을 준비할게요`
  - 본문 `이 종목의 AI 분석이 아직 없어요. 잠깐이면 준비돼요 — 끝나면 바로 공유 화면으로 이어드릴게요.`
  - 기본 CTA `분석하고 공유하기`(`bg-primary-600 hover:bg-primary-500 text-secondary-50`), 보조 `다음에`(`border border-secondary-700 text-secondary-400 hover:text-secondary-200`)
- 확인 시 `trigger()` 호출 → `SharePreparingModal`로 **교체**(다이얼로그 간 전이: 포커스를 새 모달로 이동).

### 9-3. `SharePreparingModal.tsx` — 분석 진행 로딩

- 동일 오버레이/패널 shell(`max-w-sm`). `role="dialog" aria-modal="true" aria-busy="true"`.
- 본문: 중앙 `SpinnerIcon`(`animate-spin`, `text-primary-500`) + `aria-live="polite"`로 상태 announce
  `AI가 분석 결과를 준비하고 있어요…`(말줄임 종결), 보조 `보통 10–30초면 끝나요`.
- 우상단 ✕(`aria-label="닫기"`). 닫아도 분석 자체는 계속(캐시에 남음), 공유 흐름만 취소 → ShareButton로 포커스 복원.
- 완료(`success`) 시 자동 전이: `aria-live`로 `분석이 끝났어요. 공유 옵션을 보여드릴게요.` → 데스크톱은 `ShareSheet` 첫 항목으로 포커스 이동, 모바일은 `navigator.share` 호출(OS가 포커스).
- 실패(`error`) 전이: `분석을 끝내지 못했어요. 다시 시도할까요?` + `다시 시도`(재호출) / `닫기`. (에러 카피에 다음 단계 포함.)
- `prefers-reduced-motion`: 전역 유틸이 `animate-spin` 정지 → 정적 인디케이터로 표시.

### 9-4. `ShareSheet.tsx` — 데스크톱 팝오버 / 모바일 네이티브

- **모바일**(`canShareNatively()`): `navigator.share({ title, text, url })` 직접 호출 → OS 바텀시트. 커스텀 UI 없음.
  - 사용자가 OS 시트를 **취소(AbortError)** 하면 조용히 무시(에러 토스트 금지).
- **데스크톱 / Web Share 미지원**: `usePopoverToggle` 팝오버 —
  `bg-secondary-900 border border-secondary-800 absolute right-0 z-50 mt-2 w-72 rounded-lg border p-2 shadow-2xl`.
  - 항목은 **단순 focusable 리스트**(엄격한 `role="menu"` 화살표 내비 기대를 피함): Tab 이동 + Escape 닫힘 + 열릴 때 첫 항목 포커스 + 닫힐 때 trigger 복원.
  - 행 base: `flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-secondary-200 hover:bg-secondary-800 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none transition-colors`.
  - **링크 복사** `<button>`: `useCopyToClipboard` → `copied` 시 `LinkIcon`→`CheckIcon`(`text-primary-300`) + 라벨 `복사됨`, **`aria-live="polite"`로 "링크를 복사했어요" announce**. 복사 실패 시 선택 가능한 읽기전용 input fallback 노출.
  - **X 공유** `<a target="_blank" rel="noopener noreferrer">`: `buildTweetIntentUrl`(심볼+방향성, URL 포함 길이 클램프), `XLogoIcon`.
  - **Kakao 공유** `<button>`: `NEXT_PUBLIC_KAKAO_JS_KEY` 존재 시에만 **렌더**(없으면 항목 자체 미표시), `KakaoIcon`(브랜드색은 아이콘에만, 행 배경은 중립 유지). CSP 없음 확인됨.

### 9-5. 분기 헬퍼 `src/shared/lib/share.ts`

`canShareNatively()`(navigator.share + coarse pointer), `buildTweetIntentUrl()`(길이 클램프), `buildKakaoSharePayload()`, `isShareAbort(err)`(AbortError 식별).

## 10. `/share/[id]` 공유 페이지 (`src/app/share/[id]/`)

- `page.tsx` (RSC, **동적 렌더**, 세션/auth 미사용): `getSharedAnalysis(id)` → 만료/없음이면 빈 상태 → `parseSnapshot` → 읽기전용 렌더.
- **레이아웃**(공개 랜딩, 다크 금융 톤 유지):
  - `<main>` 랜드마크 + `<h1>`(`{TICKER} AI 분석 결과`, 시각적으로는 워드마크+티커 조합). SIGLENS 워드마크는 `font-mono tracking-[0.15em] uppercase`, 티커는 mono, kind 라벨은 칩(`bg-secondary-800 text-secondary-300 text-xs`).
  - 본문: `SHARE_KIND_PANEL_REGISTRY[kind].Panel` 읽기전용(재분석·모델셀렉터 등 인터랙션 제거 확인).
  - **disclaimer(필수, 정보 톤)**: `border-secondary-700 bg-secondary-800/50 text-secondary-400 text-xs rounded-lg border px-3 py-2` — `{analyzedAt|createdAt} 기준 · 스냅샷이라 현재 시세와 다를 수 있어요`. (투자 면책 고지 박스는 기존 `border-ui-danger/30 bg-ui-danger/5` 박스를 그대로 재사용, disclaimer와 별개.)
  - **바이럴 CTA**(Acquisition 핵심): `<Link href="/{symbol}">` primary 버튼 `Siglens에서 {TICKER} 직접 분석하기`. 비회원도 클릭 가능(인증은 옵션).
- **빈 상태**(만료/없음): 중앙 안내 + 다음 단계 CTA(`<Link>` 홈 + 심볼 검색). 카피 `이 공유 링크는 만료됐어요` + `Siglens에서 최신 분석을 확인해 보세요`(에러에 다음 단계 포함).
- **모션**: 로드 시 `fade-up` 스태거(globals.css keyframe), `prefers-reduced-motion` 전역 유틸이 자동 비활성.
- `generateMetadata`: title `"[TICKER] AI 분석 결과"`, description=`buildOgText(result).description`, openGraph+twitter `summary_large_image`, **`robots:{ index:false, follow:false }`**.
- `opengraph-image.tsx` (**dynamic**, 신규): `getSharedAnalysis(id)` 로드 → `buildSymbolOgImage({ ticker: symbol, label: kindLabel })`. 만료/없음 fallback 이미지.

## 11. 엣지 케이스

| 상황 | 처리 |
|---|---|
| 분석 success(클라 보유) | 즉시 스냅샷 → 공유 시트 |
| 분석 pending(폴링 중) | 로딩 모달 → success 시 자동 진행 |
| 분석 idle/error | 부드러운 컨펌 → trigger → 로딩 → 진행 |
| congress `no_trades` / 빈 옵션 | `unavailable` 안내(공유 불가) |
| 공유 ID 없음/만료 | `/share/[id]` 만료 안내, OG fallback |
| 비회원 | `user_id` NULL, `sharer_tier='free'` |
| 동일 내용 재공유 | contentHash dedupe → 기존 id 반환 |
| 생성 스팸 | IP 해시 rate limit |
| 클라 전달값 위변조 | 서버 `assertValidInput` 스키마(형태) 검증. chart/overall만 peek 교차검증 가능, 나머지 6개 kind는 내용 위조 가능성 잔존 → **noindex + rate limit으로 완화하고 수용**(공유는 표시용, 보안 경계 아님). 향후 필요 시 서버 재실행 검증은 별도 작업 |

## 12. 비범위 (Out of Scope)

- **티어 필드 마스킹**(§0-1): core가 per-kind public filter를 갖출 때까지 구현 불가 → MVP는 full snapshot, 라이브 앱과 동일 정책. **이슈 완료조건 "티어별 필드 제한 로직 구현 및 검증"은 후속**(core 작업 선행).
- 분석 전용 동적 OG 이미지 디자인(심볼 OG 빌더 재사용 수준)
- raw 데이터 테이블 스냅샷(AI 요약 패널만)
- 만료 row 물리 삭제 배치(MVP는 조회 시 만료 판정 + lazy-delete; cron은 후속)
- 공유 횟수/조회수 집계, 내 공유 목록 관리
- 설정 가능/영구 만료(`expires_at` NOT NULL, 7일 고정)

## 13. 테스트 (이슈: domain/infra 100%)

- 순수: `buildShareSnapshot`(kind별, Serialized JSON-stable 단언), `parseSnapshot`, `generateShareId`, `contentHash`, `isExpired`
- infra: `DrizzleSharedAnalysisRepository`(create/dedupe/findById/만료)
- 서버: `createShareSnapshotAction`(rate limit / 검증 거부 / dedupe / kind 라우팅)
- 헬퍼/레지스트리: `share.ts`(분기·tweet 클램프·kakao), `kindServerRegistry`(buildOgText kind별, exhaustiveness)
- 컴포넌트: `ShareButton`(success 즉시 / pending 모달 / idle 컨펌→trigger / unavailable 안내 / 액션 중 중복클릭 방지), `ShareTriggerDialog`, `SharePreparingModal`(success 전이·error 재시도), `ShareSheet`(복사 copied 전환·실패 fallback·Kakao 키 유무)
- a11y: 아이콘 버튼 `aria-label`, 다이얼로그 `aria-modal`/labelledby/focus-trap·Escape·trigger 포커스 복원, 모달→시트 포커스 이동, 복사·로딩 `aria-live="polite"`, `navigator.share` AbortError 무시
- E2E: `/share/[id]` happy/만료/notFound, 헤더 버튼 전 탭 노출, disclaimer·바이럴 CTA 렌더, 컨펌→로딩→공유 흐름

## 14. 적용 파일 요약

신규: `entities/shared-analysis/**`, `widgets/share/**`(ShareButton·ShareTriggerDialog·SharePreparingModal·ShareSheet·kindPanelRegistry·신규 inline 아이콘), `features/share/**`(context), `shared/lib/share.ts`, `app/share/[id]/{page,opengraph-image}.tsx`, `drizzle/0022_*.sql`
수정: `shared/db/schema.ts`(+enum), `shared/db/constants`, `views/symbol/SymbolLayoutHeader.tsx`, `app/[symbol]/SymbolLayoutClient.tsx`(Provider), 8개 탭 위젯(register 1줄)+`OverallView` 추출, `.env.example`(`NEXT_PUBLIC_KAKAO_JS_KEY`), `docs/`(필요 시)
**robots.ts는 수정하지 않음**(§0-4).
