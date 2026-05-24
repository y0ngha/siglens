# PPR "couldn't find all resumable slots" 에러 근본 수정

- **작성일**: 2026-05-18
- **대상 파일**: `src/app/[symbol]/fundamental/page.tsx`, `src/app/[symbol]/overall/page.tsx`, 관련 카드 컴포넌트 7개
- **트리거**: Next.js 16 Cache Components(PPR) 환경에서 `fundamental`·`overall` 페이지 진입 시 간헐적으로 `couldn't find all resumable slots` 에러 발생

---

## 1. 배경

`next.config.ts`의 `cacheComponents: true` 설정으로 Next.js 16의 PPR(Partial Prerendering)이 활성화되어 있다. PPR은 페이지를 **정적 쉘(prerendered HTML)** + **다이나믹 슬롯(resumable holes)** 으로 분리하여, 캐시된 부분은 즉시 응답하고 다이나믹 부분만 스트리밍한다.

`couldn't find all resumable slots` 에러는 정적 쉘이 예상한 슬롯 트리 shape 와 런타임에 만들어진 React 트리 shape 가 다를 때 발생한다. 슬롯 매칭 실패 시 Next.js 는 보통 fully dynamic SSR 로 폴백하여 사용자에게는 정상 표시되지만 PPR 이득이 사라지고 서버 로그에 에러가 누적된다. 특정 조건에서는 500 응답이나 깨진 UI 로 이어질 수 있다.

## 2. 근본 원인

`fundamental/page.tsx` 의 `<Suspense>` 자식 컴포넌트들이 **조건부로 `null` 을 반환**하여 트리 shape 가 매 요청마다 달라진다.

- `ProfileSection`, `ValuationSection`, `PeersSection`, `ProfitabilitySection`, `GrowthSection`, `FinancialHealthSection`, `FutureDirectionSection` 모두 데이터 fetch 결과가 null 일 때 `return null`
- `ProfileSection` 내부의 `descriptionSlot` 은 `profile.description !== null` 일 때만 `<Suspense>` 를 생성하는 조건부 Suspense 구조

이미 같은 구조를 사용하는 `news/page.tsx` 는 Section wrapper 가 null 을 반환하지 않고 항상 표시 컴포넌트(`<NewsList>`, `<EventCalendar>`, `<AnalystActions>`)를 렌더한다 — 이 패턴이 정답이다.

`overall/page.tsx` 본체에는 `<Suspense>` 가 없으므로 별도 진단이 필요하다.

## 3. 설계 원칙

**모든 `<Suspense>` 자식 컴포넌트는 항상 동일한 React 트리 shape 를 반환한다.**

- `return null` 금지
- 조건부 `<Suspense>` 렌더 금지
- 데이터 없음은 표시 컴포넌트(Card) 내부에서 빈 상태 UI 로 처리 (news 페이지와 동일 패턴)

## 4. 변경 내역

### 4.1 `fundamental/page.tsx` — Section wrapper 7개

각 Section wrapper 의 `return null` 분기를 제거하고 항상 표시 컴포넌트를 렌더한다.

| Section | 변경 전 | 변경 후 |
|---|---|---|
| `ProfileSection` | `profile === null` → `return null` + 조건부 `<Suspense>` | 항상 `<ProfileCard profile={profile} descriptionSlot={...} />` 렌더. `profile: ProfileResponse \| null` 로 nullable 허용, descriptionSlot Suspense 도 항상 생성 |
| `ValuationSection` | `metrics === null` → null | 항상 `<ValuationCard metrics={metrics} />` (null 허용) |
| `PeersSection` | `peers.length === 0` → null | 항상 `<PeersTable peers={peers} />` (빈 배열 허용) |
| `ProfitabilitySection` | `ratios === null` → null | 항상 `<ProfitabilityCard ratios={ratios} />` |
| `GrowthSection` | `growth === null` → null | 항상 `<GrowthChart growth={growth} />` |
| `FinancialHealthSection` | `ratios === null && scores === null` → null | 항상 `<FinancialHealthCard ratios={ratios} scores={scores} cashFlow={cashFlow} />` |
| `FutureDirectionSection` | `estimates === null && grades === null && ptConsensus === null` → null | 항상 `<FutureDirectionCard ... />` |

### 4.2 카드 컴포넌트 7개 — props 시그니처 + 빈 상태 UI

각 카드가 nullable prop 을 받고 내부에서 빈 상태를 자체 처리한다.

**예시: `ValuationCard`**

```tsx
// 변경 전
interface ValuationCardProps { metrics: KeyMetricsTtm }
export function ValuationCard({ metrics }: ValuationCardProps) {
  return <section>...</section>;
}

// 변경 후
interface ValuationCardProps { metrics: KeyMetricsTtm | null }
export function ValuationCard({ metrics }: ValuationCardProps) {
  if (metrics === null) {
    return (
      <section aria-labelledby="valuation-heading" className="...기존 골격...">
        <h2 id="valuation-heading">밸류에이션</h2>
        <p className="text-secondary-400 text-sm">데이터를 불러올 수 없습니다.</p>
      </section>
    );
  }
  return <section>...정상 렌더...</section>;
}
```

**빈 상태 UI 가이드라인**
- 기존 `<section>` 골격과 제목(`밸류에이션`, `수익성` 등)은 유지 → 사용자가 어떤 영역이 비어있는지 인지 가능
- 본문만 짧은 안내 메시지("데이터를 불러올 수 없습니다") 로 대체
- 카드별 별도 디자인이 아니라 동일 톤(secondary 색상, 작은 폰트)

### 4.3 `ProfileSection` 의 `descriptionSlot`

조건부 `<Suspense>` 를 제거하고 항상 렌더한다. `ProfileDescriptionSection` 은 이미 `fallback: string` 을 받아 처리하도록 구현되어 있어 외부 조건만 제거하면 된다.

```tsx
// 변경 전
const descriptionSlot = profile.description !== null
  ? <Suspense fallback={<ProfileDescriptionSkeleton />}>
      <ProfileDescriptionSection symbol={symbol} fallback={profile.description} />
    </Suspense>
  : undefined;

// 변경 후
const descriptionSlot = (
  <Suspense fallback={<ProfileDescriptionSkeleton />}>
    <ProfileDescriptionSection symbol={symbol} fallback={profile.description ?? ''} />
  </Suspense>
);
```

`ProfileCard` 의 `descriptionSlot` prop 은 항상 전달되므로 optional 표시(`?`) 를 제거한다.

**`ProfileCard` 의 `profile === null` 처리**

`ProfileCard` 가 `profile: ProfileResponse | null` 을 받게 되므로, null 케이스에서도 descriptionSlot 을 동일한 위치에 렌더해야 트리 shape 가 안정된다. 즉 빈 상태 UI 의 마크업 끝부분에 descriptionSlot 을 그대로 끼워 넣는다.

```tsx
export function ProfileCard({ profile, descriptionSlot }: ProfileCardProps) {
  if (profile === null) {
    return (
      <section aria-labelledby="profile-heading" className="...기존 골격...">
        <h2 id="profile-heading">회사 프로필</h2>
        <p className="text-secondary-400 text-sm">데이터를 불러올 수 없습니다.</p>
        {descriptionSlot}
      </section>
    );
  }
  return <section>...정상 렌더 + {descriptionSlot}...</section>;
}
```

이때 `ProfileDescriptionSection` 도 `fallback === ''` 인 케이스를 빈 `<p>` 또는 null 로 처리하도록 보강 (이미 `descriptionKo ?? fallback` 패턴이므로 fallback 이 빈 문자열이면 빈 `<p>` 렌더 — 빈 상태와 자연스럽게 조화).

### 4.4 `overall/page.tsx` 진단

`overall/page.tsx` 본체에는 `<Suspense>` 가 없으므로 PPR resumable slot 에러가 직접 발생할 수 없다. 가능 경로 셋을 진단한다:

| 경로 | 검증 방법 | 조치 |
|---|---|---|
| **(a) 상위 layout** | `src/app/layout.tsx`, `src/app/[symbol]/layout.tsx` 에 Suspense / `'use cache'` / 조건부 분기 있는지 확인 | layout 의 조건부 분기 제거하여 트리 shape 안정화 |
| **(b) `searchParams.tf` 가 정적 쉘 무효화** | `overall/page.tsx:83` — `await searchParams` 가 페이지 전체를 dynamic 으로 만들어 PPR 쉘 생성을 막는지 확인. `yarn build` 출력에서 overall 라우트 표시(`○`/`ƒ`/`◐`) 확인 | `tf` 를 `<OverallContent>` 에 prop 으로 넘기지 말고 클라이언트가 `useSearchParams()` 로 직접 읽도록 변경. `page.tsx` 는 `tf` 를 모르게 되어 정적 쉘 생성 가능 |
| **(c) `OverallContent` 의 hydration mismatch** | dev 환경에서 hydration warning 같이 발생하는지 확인 | **범위 OUT** — 별도 이슈로 분리 |

**진단 액션** (구현 단계 첫 작업):
1. `yarn build` 실행 → overall 라우트가 Static/Dynamic/PPR 중 무엇인지 확인
2. `[symbol]/layout.tsx` 와 `src/app/layout.tsx` 읽고 Suspense / 조건부 분기 점검
3. 결과에 따라 (a) 또는 (b) 경로만 수정. (c) 라면 이번 PR 에서 제외하고 별도 이슈 등록

## 5. 테스트 계획

PPR resumable slot 자체는 런타임 통합 동작이라 자동화 테스트로 직접 검증하기 어렵다. **자동화 단위 테스트 + 수동 통합 검증** 조합으로 접근한다.

### 5.1 자동화 (Jest)

각 변경된 카드 컴포넌트에 nullable prop 케이스 단위 테스트 추가:
- `ValuationCard` — `metrics={null}` 케이스에서 크래시 없이 빈 상태 UI 렌더
- `ProfitabilityCard`, `GrowthChart`, `FinancialHealthCard`, `FutureDirectionCard`, `ProfileCard`, `PeersTable` 동일

기존 정상 케이스 테스트는 그대로 유지.

### 5.2 수동 검증

1. **데이터 풍부한 종목 (AAPL, MSFT 등)** — 모든 카드 정상 표시 확인
2. **데이터 희소한 종목 (마이너 종목, 신규 상장)** — 일부 카드가 빈 상태로 표시되며 페이지 깨지지 않는지 확인
3. **production 빌드 검증** — `yarn build && yarn start` 후 fundamental/overall 페이지 진입, 콘솔에 resumable slot 에러 없는지 확인
4. **Vercel preview 배포 후** 동일 검증

## 6. 범위

### 범위 IN
- `fundamental/page.tsx` Section wrapper 7개 + `descriptionSlot` 조건부 Suspense 제거
- 카드 컴포넌트 7개 props 시그니처 변경 + 빈 상태 UI 추가
- `overall` 페이지 진단 및 (a)/(b) 경로 수정 (해당될 경우)
- 카드 컴포넌트 nullable prop 케이스 단위 테스트 추가

### 범위 OUT (별도 이슈로 분리)
- fetch 함수가 throw 하는 경우의 ErrorBoundary 처리 — 현재는 Next.js `error.tsx` 가 페이지 전체 처리
- `overall` 진단 결과가 (c) 경로(OverallContent hydration)일 경우의 수정
- "`<Suspense>` 자식 컴포넌트는 `null` 반환 금지" ESLint custom rule

## 7. 리스크와 완화

| 리스크 | 완화 |
|---|---|
| 데이터 희소 종목에서 빈 카드가 7개 줄줄이 표시되어 UX 저하 | 카드 골격은 유지하되 본문은 짧은 메시지로 처리하여 시각적 노이즈 최소화. 마이너 종목은 트래픽 비중이 낮아 영향 제한적 |
| 카드 컴포넌트 시그니처 변경이 다른 호출처에 영향 | 카드 컴포넌트는 `fundamental/page.tsx` 의 Section wrapper 에서만 호출됨 — 호출처 단일 (`grep` 으로 확인 후 진행) |
| overall 진단이 (c) 경로로 판명될 경우 PR 분리 필요 | 진단을 구현 단계 첫 작업으로 두어 빠르게 판단. (c) 라면 사용자에게 보고 후 별도 이슈로 옮김 |

---

**다음 단계**: 사용자 spec 리뷰 → `writing-plans` 스킬로 step-by-step 구현 계획 작성
