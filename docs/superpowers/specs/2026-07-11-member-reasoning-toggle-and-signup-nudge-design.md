# 회원 분석 혜택 — 교차-provider 추론 토글 + 비회원 유도 모달 — 설계

- 작성일: 2026-07-11
- 범위: **3개 레포**(`siglens-core` + `siglens-worker` + `siglens`). **A+B를 한 릴리스로** 함께 출시.
- 상위 목표: 무료=추론 OFF, 회원=추론 ON/OFF 토글, 비회원 3회 분석 시 회원가입 유도. (앞서 미룬 "회원 게이팅"의 실질 구현)

## 0. 왜 A+B를 함께?

B의 모달은 "가입하면 더 자세한 분석"을 약속한다. 현재는 `enableTierRestrictions:false`라 회원이 실제로 더 받는 게 없다 → **A(추론 토글)가 그 약속을 실재화**한다. 그래서 함께 출시한다.

## 1. 확정 결정

| 항목 | 결정 |
|---|---|
| 추론 범위 | **모든 provider 교차 적용** (요청별 `reasoning: boolean`) |
| ON/OFF 매핑 | ON = 모델 스펙 기본 reasoning / OFF = provider별 **최소화** |
| 티어 | 무료 = OFF **서버 강제** · 회원 = 토글(기본 OFF opt-in) |
| 적용 범위 | **전역 토글 1개** = 사용자 모델을 쓰는 **모든 심볼 분석에 일괄 적용**(모델 선택기와 동일 방식). briefing(고정 모델)은 제외 |
| 3회 카운팅 | **하루 서로 다른 심볼 3개** 분석 → 모달(캐시히트도 "봤으면" 카운트) |
| 3회 동작 | **소프트 넙지, 분석 절대 차단 안 함** ("지금은 계속 가능") |
| 카운트 저장 | 클라이언트 localStorage(소프트라 서버 불필요) |

---

## Part A — 교차-provider 추론(깊은 생각) 토글

### A.1 요청별 reasoning 파라미터
- 분석 submit 경로에 옵셔널 **`reasoning?: boolean`** 추가(Gemini `thinkingBudget` 요청 override 선례와 동형): siglens submit action → core submit 함수 옵션 → 워커 `/analyze` body → `callAnalysisAI`.
- **캐시 키에 reasoning 포함**(core): ON/OFF는 다른 출력이므로 캐시 분리(cache key builder + peek 경로 모두). 이게 없으면 회원이 ON으로 받은 결과를 비회원이 캐시로 받는 오염 발생.

### A.2 provider별 매핑 (worker `callAnalysisAI`에서 중앙 번역)
`reasoning` boolean → 각 어댑터의 기존 override 파라미터로 변환:

| provider | ON (스펙 기본) | OFF (최소화) | 시임 |
|---|---|---|---|
| deepseek | thinking = spec.thinking | `thinking: {type:'disabled'}` | **신규** `thinking?` override(deepseek.ts, deepseek-retry, AnalyzeRequest) |
| gemini | thinkingBudget = spec | `thinkingBudget: 0`(DISABLED_THINKING_BUDGET) | **존재**(gemini.ts `options.thinkingBudget`) |
| claude | effort = spec.effort | `effort: 'low'`(sonnet/opus 최소; haiku는 원래 없음) | **존재**(claude.ts `options.effort`) |
| gpt | effort = spec.effort | `effort: 'low'` | **신규** `effort?` override(chatgpt.ts는 현재 spec.effort 고정) |

- `callAnalysisAI(model, {reasoning, ...})`: `reasoning===false`면 위 OFF 값을 해당 provider 호출 옵션으로 주입, `true`(또는 미지정+회원)면 스펙 기본.
- briefing 경로는 reasoning 토글 대상 아님(서버 결정, 기본 OFF 유지).

### A.3 티어 강제 (서버)
- 분석 submit action에서 tier 확인(`resolveTierAndByok`/`getCurrentUser`). **tier가 free/비회원이면 `reasoning`을 서버에서 false로 강제**(클라 값 무시). 회원(member/pro)만 클라 토글 값을 전달.
- 전역 `enableTierRestrictions`는 건드리지 않음(요청 레벨 게이트).

### A.4 UI (siglens)
- 분석 모델 선택기 옆 **"깊은 생각" 토글**(`features/symbol-model` 또는 신규 `features/reasoning-toggle`).
- **회원만 노출·활성**. 비회원: 숨김 또는 잠금 표시(클릭 시 Part B 모달로 유도 — 연결 옵션).
- 기본 OFF. ON 시 안내 문구: **"추론을 켜면 상세 분석을 하느라 응답이 다소 지연될 수 있어요."**
- 토글 값은 분석 submit 시 `reasoning`으로 전달. 값 변경 시 재분석(캐시 키 다름).

---

## Part B — 비회원 3회(서로 다른 심볼) → 회원가입 유도 모달 (siglens 프론트)

### B.1 카운팅 (클라이언트)
- `shared/lib/anonAnalysisCount.ts`: localStorage `siglens_anon_analyzed_symbols` = `{ dateUtc, symbols: string[] }`. UTC일 바뀌면 리셋.
- `recordAnonSymbolAnalysis(symbol, now): { distinctCount, crossedThreshold }` — symbols에 없으면 추가(**심볼 dedup**), distinctCount = symbols.length. 처음 3 도달 시 crossedThreshold. SSR 가드 + try/catch no-op(시크릿/차단).
- 별도 `nudge_shown`(오늘 노출 여부) 플래그로 nag 방지.

### B.2 훅 & 트리거
- `features/analysis-nudge/hooks/useAnonAnalysisNudge`: **비회원일 때만**(로그인 판별 완료 후) 심볼 분석 시 `recordAnonSymbolAnalysis(symbol)` 호출. distinctCount가 3 도달 + 오늘 미노출이면 모달 open.
- 연결 지점: 심볼 페이지 분석이 **렌더/완료되는 시점**(value-first — 3번째 결과를 본 뒤 모달). 정확한 훅은 구현 시 확정(후보: `views/symbol` 분석 완료 콜백).

### B.3 모달
- `features/analysis-nudge/ui/AnalysisSignupNudgeModal.tsx`: `PremiumModelGateModal`의 auth 모드 UI 재사용/추출. 문구 "**더 깊은 분석을 원하세요? 회원가입하면 추론(깊은 생각)을 켜고 더 자세한 리포트를 받을 수 있어요.**" + `<Link href="/signup">회원가입 하러 가기</Link>` + 닫기. focus-trap/escape/backdrop 재사용.
- 분석은 항상 완료(모달은 정보성, 차단 X).

---

## 2. 데이터 흐름 (통합)

```
[비회원 심볼 분석]
  submit(reasoning=false 서버강제) → 결과(추론 OFF) → 렌더
  → recordAnonSymbolAnalysis(symbol): distinct 3 도달 시 모달("가입하면 추론 ON")
[회원]
  깊은 생각 토글 ON → submit(reasoning=true) → 추론 ON 결과(지연 안내) / 카운트·모달 없음
```

## 3. 레포별 변경 요약

- **siglens-core**: 분석 submit 함수들에 `reasoning?: boolean` 옵션 + 워커 body 전달 + **캐시 키에 reasoning 포함**(cache key builder + peek). tier→reasoning 강제는 consumer가 값 주입(core는 받은 값 사용).
- **siglens-worker**: `AnalyzeRequest`에 `reasoning?` 파싱, `callAnalysisAI`에서 provider별 OFF 매핑 번역. deepseek.ts에 `thinking?` override, chatgpt.ts에 `effort?` override 추가. gemini/claude는 기존 override 사용.
- **siglens**: 분석 submit action에서 tier 판별→reasoning 강제(free=false)·회원 토글값 전달. "깊은 생각" 토글 UI(회원만). anonAnalysisCount + useAnonAnalysisNudge + AnalysisSignupNudgeModal. cache-key 정렬(SSR peek도 reasoning 포함).

## 4. 에러/엣지
- reasoning ON/OFF 캐시 오염 방지 = 캐시 키 포함(핵심).
- claude adaptive-thinking은 완전 off 불가 → effort:'low' 최소화(문서화). haiku/gpt-mini 등 원래 저-reasoning 모델은 OFF가 거의 무효과(허용).
- localStorage 차단/시크릿 → 카운트·모달 no-op(크래시 X). SSR 가드.
- 로그인 판별 지연 → 판별 완료 전 미카운트·토글 숨김.
- 소프트 넙지라 localStorage 조작 우회 허용.

## 5. 테스트 (≥90%)
- core: reasoning이 워커 body·캐시 키에 반영(캐시 키 ON≠OFF), submit 옵션 통과.
- worker: callAnalysisAI가 reasoning=false 시 각 provider OFF 값 주입(deepseek disabled/gemini 0/claude·gpt effort low), true 시 스펙 기본. 어댑터 override 단위.
- siglens: tier 강제(free→reasoning false, member→토글값), 토글 UI(회원만), anonAnalysisCount(심볼 dedup·일 리셋·차단 no-op·SSR), useAnonAnalysisNudge(회원 no-op·3심볼 모달·nag 방지), 모달(CTA/닫기/a11y). e2e(선택): 게스트 3종목 후 모달, 회원 토글 ON.

## 6. 릴리스 순서 (DeepSeek과 동일 cross-repo)
core(reasoning param+캐시키) → PR·승인·병합·릴리스 → worker/siglens core bump → 각 구현·PR. 실증: prod 빌드 + 회원/비회원 시나리오(curl+Chrome).

## 7. 범위 밖
- briefing 추론 토글, 서버측 하드 카운팅/차단, 결제/tier 승급, 모델 선택 자체의 회원 전용 게이팅(별도).
