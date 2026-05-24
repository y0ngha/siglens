# 봇 접근 시 Redis 워커 트리거 차단 설계

> 작성일: 2026-05-11
> 관련 레포: `siglens`, `@y0ngha/siglens-core`

## 1. 배경 및 문제 정의

[symbol] 페이지에 진입하면 클라이언트의 `useAnalysis` 훅이 마운트와 동시에 `submitAnalysisAction` (Server Action) 을 호출하고, core 의 `submitAnalysis()` 가 캐시 미스 시 Redis 에 분석 Job 을 enqueue 한다. Overall · Fundamental · News 탭에서도 각각 동일 패턴의 분석 훅이 동작한다.

Googlebot 을 포함한 크롤러들이 모든 종목 페이지와 서브 탭을 방문하면서 매 크롤마다 동일한 분석 파이프라인을 그대로 태우고 있어 Redis 사용량이 급증했다. 비용 자체는 크지 않으나 (1) 봇 트래픽이 워커 큐를 점유하고 (2) 분석 결과가 봇 입장에서는 활용 가치가 낮으며 (3) 캐시되지 않은 long-tail 종목까지 매번 큐가 잡힌다는 문제가 있다.

## 2. 목표

- 봇 요청에서는 Redis 워커 트리거를 발생시키지 않는다.
- 캐시에 결과가 존재하면 봇에게도 그대로 노출해 SEO 인덱싱 가치는 유지한다.
- 캐시가 없는 봇 요청은 분석 섹션을 fallback 문구로 대체한다.
- false-positive (실유저가 봇으로 잘못 판정) 케이스에 실효성 있는 안내를 제공한다.

## 3. 비목표

- 봇 트래픽 자체를 차단하지 않는다. 페이지 렌더 (HTML, 메타데이터, 차트 정적 데이터) 는 그대로 제공한다.
- 분석 캐시 키 / TTL / 만료 정책은 변경하지 않는다 (core 소관).
- robots.txt / sitemap 변경은 본 작업의 범위가 아니다.
- 챗봇 트리거는 사용자 인터랙션 기반이라 봇이 자동으로 호출할 일이 없으므로 범위에서 제외한다.

## 4. 설계 결정

### 4.1 캐시 read-only 조회

`submitAnalysis()` 에 옵셔널 파라미터 `skipEnqueueIfMiss` 를 추가한다. 별도의 `peekAnalysisCache()` 함수를 신설하지 않고 기존 함수의 시그니처를 확장하는 방향을 택한다. 이유는 (1) public surface 증가를 최소화하고 (2) 캐시 hit 분기 로직이 기존 함수에 이미 있어 재사용 가능하기 때문이다.

새 응답 status: `'miss_no_trigger'`. 캐시 미스이면서 옵션이 켜져 있을 때 enqueue 없이 즉시 반환한다.

동일 패턴의 다른 분석 use-case (`submitBriefing`, `submitFundamentalAnalysis`, `submitNewsAnalysis` 등 실제 존재하는 함수) 에도 동일 옵션을 추가한다.

### 4.2 봇 판정

Next.js 공식 helper `userAgent(headers)` (from `next/server`) 의 `isBot` 필드를 사용한다. Vercel 이 관리하므로 패턴이 자동 최신화되며 deep import 가 아니다.

판정 위치는 **Server Action 진입부** 단일 게이트. RSC 에서 prop 으로 내려보내는 방식은 채택하지 않는다. 이유는 (1) Server Action 한 곳에서 막으면 모든 클라이언트 트리거가 자동으로 커버되고 (2) RSC prop 방식은 클라이언트 hook 의 코드 경로를 추가로 분기시켜 복잡도를 늘리며 (3) Server Action 진입부 판정만으로 Redis 호출이 완전히 차단되기 때문이다.

### 4.3 차단 범위

[symbol] 라우트의 4개 분석 트리거 전부:

- `useAnalysis` (메인 차트)
- `useOverallAnalysis`
- `useFundamentalAnalysis`
- `useNewsAnalysis`

각각이 호출하는 Server Action 진입부 모두에 동일 게이트를 적용한다.

### 4.4 Fallback UI

공통 컴포넌트 `BotBlockedNotice` 를 추출해 4개 분석 섹션이 동일 status (`'miss_no_trigger'`) 를 받으면 동일하게 렌더한다.

문구:

> 자동화된 접근으로 판정되어 분석 결과를 표시하지 않습니다.
> 실제 사용자라면 다른 브라우저로 접속하시거나 문의해 주세요.

사용자가 처음 제안한 "브라우저를 완전히 종료" 안내는 실효성이 없어 (UA 는 브라우저 재시작과 무관) 제외한다. "다른 브라우저로 접속" + "문의" 가 false-positive 유저가 실제로 실행 가능한 조치다.

## 5. 아키텍처 변경

### 5.1 siglens-core PR (선행)

| 파일 | 변경 |
|---|---|
| `application/analysis/submitAnalysis.ts` | `skipEnqueueIfMiss?: boolean` 옵션 추가, miss + 옵션 ON 일 때 `{ status: 'miss_no_trigger' }` 반환 |
| 동일 패턴의 다른 submit use-case (briefing 등 실존 함수) | 동일 옵션 추가 |
| public 타입 정의 | status union 에 `'miss_no_trigger'` 추가 |
| 유닛 테스트 | 캐시 hit / miss + 옵션 ON·OFF 매트릭스 |

core 머지 → publish → siglens 에서 package.json 버전 업데이트.

### 5.2 siglens PR (후행)

| 파일 | 변경 |
|---|---|
| `src/lib/isBot.ts` (신규) | `next/server` 의 `userAgent(headers).isBot` 래퍼. 테스트 가능하도록 분리 |
| `src/infrastructure/market/submitAnalysisAction.ts` | 진입부 `isBot()` → `skipEnqueueIfMiss` 전달 |
| Overall / Fundamental / News 의 submit Action 파일 (구현 단계에서 위치 확정) | 동일 패턴 |
| `src/components/symbol-page/BotBlockedNotice.tsx` (신규) | 공통 fallback UI |
| `src/components/symbol-page/hooks/useAnalysis.ts` 및 3개 분석 훅 | `status === 'miss_no_trigger'` 분기 추가 |
| 각 분석 섹션 컴포넌트 | `BotBlockedNotice` 렌더 분기 |

### 5.3 데이터 흐름

```
[봇 요청]
  Client mount → Server Action
    → headers() → userAgent(h).isBot = true
    → core.submitAnalysis({ ..., skipEnqueueIfMiss: true })
      ├ cache hit  → { status: 'cached', result } → 평소 렌더
      └ cache miss → { status: 'miss_no_trigger' } → BotBlockedNotice 렌더

[실유저 요청]
  Client mount → Server Action
    → headers() → userAgent(h).isBot = false
    → core.submitAnalysis({ ... })  // 옵션 미설정, 기존 동작
      ├ cache hit  → { status: 'cached', result }
      └ cache miss → { status: 'submitted', jobId } → polling 시작
```

## 6. 레이어 의존 규칙 검토

- `lib/isBot.ts`: `next/server` 만 의존, 순수 함수. lib 레이어 규칙 위반 없음.
- Server Action: 기존에 이미 `headers()` 사용 가능한 위치. `lib/isBot.ts` 와 `@y0ngha/siglens-core` 만 import.
- `BotBlockedNotice`: 순수 프레젠테이션 컴포넌트. domain / lib 만 import.
- core 변경: SCOPE.md §0 "분석 Job 큐 라이프사이클" 영역에 해당 → core 가 소유. 적합.

위반 없음.

## 7. 테스트 전략

- `lib/isBot.ts` 유닛: Googlebot / bingbot / 일반 Chrome / 빈 헤더 / 빈 UA
- Server Action 통합: 봇 UA + 캐시 hit, 봇 UA + 캐시 miss, 실유저 UA + 캐시 hit, 실유저 UA + 캐시 miss 4 케이스
- `BotBlockedNotice` 렌더 테스트
- core 측: `skipEnqueueIfMiss` 옵션 ON/OFF × hit/miss 4 케이스 유닛

## 8. 위험 요소 및 완화

| 위험 | 완화 |
|---|---|
| Long-tail 종목이 끝내 캐시되지 않아 봇이 항상 fallback 만 봄 | 수용. 실유저가 한 번 트리거하면 캐시 워밍됨. 의도된 트레이드오프. |
| Next 의 `userAgent` helper 의 봇 패턴이 위조된 UA 를 통과시킴 | 1차 방어선으로 충분. 위조 UA 는 일반적인 봇 트래픽이 아니므로 비용 영향 미미. |
| false-positive 유저 발생 | 안내 문구로 다른 브라우저 / 문의 경로 제공. 로그를 통해 빈도 모니터링 가능. |
| core PR publish 지연으로 siglens 작업이 블록 | 작업 순서 명확화 (core → publish → siglens). 본 spec 에서 명시. |

## 9. 작업 순서 요약

1. core 에 `skipEnqueueIfMiss` 옵션 PR 작성·머지·publish
2. siglens 의 `@y0ngha/siglens-core` 버전 업데이트
3. siglens 에 `lib/isBot.ts` + 각 Server Action 게이트 + `BotBlockedNotice` + 훅 분기 추가
4. 테스트 작성·통과 확인
