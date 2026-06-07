# Skill Confidence Policy and Usage Roles — 설계 스펙

- **작성일**: 2026-06-07
- **상태**: 설계 승인 완료, 사용자 문서 리뷰 대기
- **범위**: `siglens-core`(정책·타입·프롬프트·후처리) + `siglens`(스킬 카탈로그·검증·현재 문서·UI 카피)
- **구현 순서**: `siglens-core` 선행 → 로컬 build overlay로 `siglens` 통합 → core 정식 배포 → clean install 최종 검증

---

## 1. 배경

현재 `confidence_weight`는 영역마다 서로 다른 의미와 동작을 가진다.

- 문서상 `< 0.5` 스킬은 프롬프트에서 완전히 제외된다고 되어 있다.
- 차트 프롬프트는 이미 confidence 하한을 적용하지 않고 동적 gating만 적용한다.
- fundamental/news 프롬프트는 여전히 `< 0.5` 스킬을 제외한다.
- 분석 응답 후처리는 `< 0.5` 패턴 결과를 제거한다.
- 차트 스킬 라벨은 `High`와 `Medium`만 지원하므로 `0.0~0.79`가 모두 `Medium`으로 표시된다.
- home의 Skills Showcase tooltip은 `50% 미만이면 분석에서 제외돼요`라고 안내해 잘못된 정책을
  사용자에게 직접 노출한다. confidence bar도 `0.8` 기준 2색만 사용해 Low와 Medium이 같은
  색으로 보인다.
- 최근 pro-indicator의 낮은 값은 단독 방향 예측력의 한계를 표현하지만, 변동성 측정이나
  레짐 분류처럼 방향 예측을 목적으로 하지 않는 도구에도 같은 숫자 축이 사용된다.

그 결과 낮은 값이 "쓸모없는 스킬" 또는 "40% 적중률"처럼 오해될 수 있고, 역할에 맞게
유용한 스킬도 임의의 하한으로 제거될 수 있다.

Wyckoff 전략은 필요한 60~120개 상세 봉을 시스템이 제공하지 않아 `confidence_weight: 0.0`
으로 비활성화되어 있다. 하한 필터를 제거하면 이 전략이 다시 주입되므로, 비활성 상태를
유지하는 대신 카탈로그에서 완전히 제거한다.

---

## 2. 목표

1. `confidence_weight`를 **해당 스킬의 해석을 분석에 반영할 신뢰 수준**으로 통일한다.
2. confidence를 스킬 포함 여부와 분리한다.
3. 모든 스킬 유형에서 `< 0.5` 하한 필터를 제거한다.
4. `Low / Medium / High` 세 등급을 모든 AI 프롬프트에서 일관되게 표시한다.
5. `indicator_guide`의 용도를 `usage_roles`로 명시하여 신뢰도와 역할을 분리한다.
6. 사용할 수 없는 Wyckoff 전략과 현재 동작을 설명하는 참조를 완전히 제거한다.
7. 기존 동적 gating, category 선택, 프롬프트 결정성은 유지한다.

---

## 3. 비목표

- 기존 37개 보조지표의 `confidence_weight` 숫자를 이번 작업에서 재산정하지 않는다.
- confidence를 적중률, 수익 확률 또는 통계적 유의확률로 해석하지 않는다.
- `pattern`, `strategy`, `candlestick`, `support_resistance`, `fundamental`, `news`에
  `usage_roles`를 도입하지 않는다.
- 새로운 보조지표 계산식, 시그널 detector, gating 임계값을 추가하지 않는다.
- 과거 설계서, 구현 계획, changelog 같은 역사 기록을 현재 정책에 맞춰 소급 수정하지 않는다.
- 로컬 overlay 결과물을 커밋하거나 정식 패키지 대신 배포하지 않는다.

---

## 4. 확정된 정책

### 4.1 confidence 의미

`confidence_weight`는 `0.0~1.0` 범위의 숫자를 유지한다.

> 해당 스킬이 자신의 의도된 역할로 제공하는 해석을 분석에 어느 정도 비중으로 반영할지
> 나타내는 상대적 신뢰 수준이다.

다음을 의미하지 않는다.

- 방향 예측 적중 확률
- 기대수익률
- 통계적 유의확률
- 스킬 포함 또는 제외 조건

### 4.2 표시 등급

등급은 별도 frontmatter로 저장하지 않고 `confidence_weight`에서 파생한다.

| 범위 | 등급 | 프롬프트 라벨 |
|---|---|---|
| `0.0 <= weight < 0.5` | Low | `[Low Confidence]` |
| `0.5 <= weight < 0.8` | Medium | `[Medium Confidence]` |
| `0.8 <= weight <= 1.0` | High | `[High Confidence]` |

경계값은 단일 core helper가 소유한다. enum 필드와 숫자를 병행 저장하지 않는다.

### 4.3 포함 정책

confidence는 어느 경로에서도 포함 여부를 결정하지 않는다.

| 영역 | 포함 조건 |
|---|---|
| 차트 스킬 | 기존 `gating` 조건만 적용 |
| fundamental 스킬 | `category === 'fundamental'` |
| news 스킬 | `category === 'news'` |
| 패턴 결과 | 정규화에 성공한 모든 결과 유지 |
| 전략 결과 | 기존처럼 정규화에 성공한 모든 결과 유지 |
| 기타 스킬 | 각 프롬프트의 기존 type/category/gating 규칙 |

`confidence_weight: 0.0`도 유효한 Low confidence 값이다. 비활성화 수단으로 사용하지 않는다.
스킬을 사용하면 안 되는 경우 파일을 제거하거나 명시적인 도메인 정책으로 비활성화해야 한다.

---

## 5. `usage_roles` 데이터 모델

### 5.1 frontmatter

모든 `indicator_guide`는 비어 있지 않은 복수 역할 배열을 가져야 한다.

```yaml
usage_roles: [signal, confirmation]
```

허용 역할:

```text
signal | confirmation | regime | measurement | risk
```

역할 의미:

| 역할 | 의미 |
|---|---|
| `signal` | 방향성 이벤트나 진입·청산 후보를 제시 |
| `confirmation` | 다른 신호의 품질이나 방향을 확인 |
| `regime` | 추세·횡보·평균회귀 같은 시장 국면을 분류 |
| `measurement` | 가격, 거래량, 변동성 또는 구조를 측정 |
| `risk` | 포지션 크기, 손절 거리, 추적 청산 등 위험 관리에 사용 |

### 5.2 core 타입

```typescript
export type SkillUsageRole =
    | 'signal'
    | 'confirmation'
    | 'regime'
    | 'measurement'
    | 'risk';

export interface Skill {
    // existing fields...
    usageRoles?: SkillUsageRole[];
}
```

`usageRoles`는 core 공개 타입에서 선택 필드로 둔다. 외부 소비자와 구버전 카탈로그의
호환성을 유지하기 위해서다. 다만 `siglens`의 카탈로그 validator는
`type: indicator_guide`에 이를 필수로 강제한다.

### 5.3 검증 규칙

- `indicator_guide`: `usage_roles` 필수, 비어 있지 않은 배열
- 다른 skill type: `usage_roles` 금지
- 허용 enum 외 값: 실패
- 중복 역할: 실패
- 배열이 아닌 값: 실패
- 역할 순서: 아래 canonical order를 따라야 함

```text
signal → confirmation → regime → measurement → risk
```

core 런타임 loader/parser는 외부 또는 구버전 스킬에 대해 fail-safe로 동작한다.
유효하지 않거나 누락된 역할은 `usageRoles: undefined`로 정규화하고 역할 라벨만 생략한다.
`siglens` CI에서는 동일 상태를 배포 전에 실패시킨다.

---

## 6. 보조지표 역할 초기값

이번 마이그레이션은 아래 값을 그대로 적용한다. 구현 중 임의로 역할을 재분류하지 않는다.

| 파일 | `usage_roles` |
|---|---|
| `adx.md` | `[confirmation, regime]` |
| `atr.md` | `[confirmation, measurement, risk]` |
| `bollinger-bands.md` | `[signal, confirmation, measurement]` |
| `bollinger-percent-b.md` | `[signal, confirmation, measurement]` |
| `buy-sell-volume.md` | `[confirmation, measurement]` |
| `cci.md` | `[signal, confirmation]` |
| `chandelier-exit.md` | `[regime, risk]` |
| `cmf.md` | `[signal, confirmation, measurement]` |
| `connors-rsi.md` | `[signal, confirmation]` |
| `dmi.md` | `[signal, confirmation, regime]` |
| `donchian-channel.md` | `[signal, confirmation, measurement]` |
| `elder-impulse.md` | `[confirmation, regime]` |
| `elder-ray.md` | `[signal, confirmation]` |
| `ema.md` | `[signal, confirmation, regime]` |
| `ewma-volatility.md` | `[measurement, risk]` |
| `force-index.md` | `[signal, confirmation]` |
| `hurst.md` | `[regime]` |
| `ichimoku-cloud.md` | `[signal, confirmation, regime]` |
| `keltner-channel.md` | `[signal, confirmation, measurement]` |
| `ma.md` | `[signal, confirmation, regime]` |
| `macd-v.md` | `[confirmation]` |
| `macd.md` | `[signal, confirmation]` |
| `mfi.md` | `[signal, confirmation, measurement]` |
| `obv.md` | `[confirmation, measurement]` |
| `parabolic-sar.md` | `[signal, confirmation, risk]` |
| `regression-r2.md` | `[regime]` |
| `rsi.md` | `[signal, confirmation]` |
| `smart-money-concepts.md` | `[signal, confirmation, regime]` |
| `squeeze-momentum.md` | `[signal, confirmation, measurement]` |
| `stochastic-rsi.md` | `[signal, confirmation]` |
| `stochastic.md` | `[signal, confirmation]` |
| `supertrend.md` | `[signal, confirmation, risk]` |
| `variance-ratio.md` | `[regime]` |
| `volume-profile.md` | `[confirmation, measurement]` |
| `vwap.md` | `[signal, confirmation, measurement]` |
| `williams-r.md` | `[signal, confirmation]` |
| `yang-zhang.md` | `[measurement, risk]` |

---

## 7. 프롬프트 표현

### 7.1 공통 confidence helper

core는 confidence 등급과 프롬프트 라벨을 만드는 단일 helper를 제공한다. 차트,
fundamental, news 프롬프트가 같은 helper를 사용한다.

```text
### MACD-V Signal Guide [Low Confidence] [Roles: Confirmation]
### RSI Signal Guide [High Confidence] [Roles: Signal, Confirmation]
### Value Investing [High Confidence]
```

- 역할 라벨은 `indicator_guide`이면서 `usageRoles`가 있을 때만 표시한다.
- 역할 표시는 canonical order로 결정적이어야 한다.
- confidence 라벨은 모든 스킬 유형에 표시한다.
- Low confidence도 본문과 함께 포함된다.
- Low는 "무시"가 아니라 "보조적으로 반영"해야 한다는 프롬프트 의미를 가진다.

### 7.2 기존 measured-reliability 문구

pro-indicator 본문의 measured-reliability 설명과 `PRO_RELIABILITY_NOTE`는 유지한다.
이 문구는 특정 지표의 사용 한계를 설명하며 공통 등급 라벨보다 상세한 근거다.

본문의 `confidence weight 0.x`는 확률이 아니라 본 정책의 상대적 분석 비중임을
현재 스킬 작성 가이드에서 명시한다.

### 7.3 home Skills Showcase 표시

`siglens` home의 `SkillsShowcase`(`src/widgets/home/SkillsShowcase.tsx`)는 confidence를
사용자에게 직접 노출하므로 본 정책과 일치시킨다.

**tooltip 문구** — 현재 `ConfidenceInfoTooltip`의 잘못된 "50% 미만이면 분석에서 제외돼요"
문구를 제거하고 3등급 설명형으로 교체한다.

```text
분석 기법의 신뢰도 점수예요.
50% 미만 낮음 · 50~80% 보통 · 80% 이상 높음.
낮은 점수도 분석에 보조적으로 반영돼요.
```

**confidence bar 색상** — 현재 `0.8` 기준 2색을 §4.2 등급과 동일한 Low/Medium/High 3색으로
구분한다.

| 등급 | 범위 | 색상 토큰 |
|---|---|---|
| High | `weight >= 0.8` | `bg-chart-bullish` |
| Medium | `0.5 <= weight < 0.8` | `bg-ui-warning` |
| Low | `weight < 0.5` | `bg-secondary-500` |

Low는 빨강 계열(`ui-danger` / `chart-bearish`)을 사용하지 않는다. 빨강은 방향성 bearish와
혼동되고 "제외 또는 나쁨"으로 읽혀 "Low도 분석에 반영된다"는 정책과 모순되기 때문이다.
중립 회색으로 "상대적으로 약한 신뢰"를 표현한다.

**경계 상수** — 등급 경계(`0.5`, `0.8`)는 §4.2와 동일한 값을 사용한다. `SkillsShowcase`는
client component이며 lcp-discovery 의존성 절단을 위해 `HIGH_CONFIDENCE_WEIGHT` `0.8`을
파일 내 인라인 상수로 둔 상태다(파일 내 주석 참조). Medium 경계 `0.5`도 동일하게 인라인
상수로 추가하되 값은 core helper 경계와 일치시킨다. 접근성 속성(`aria-label`,
`role="tooltip"` 등)은 유지한다.

---

## 8. 하한 필터 제거

### 8.1 `siglens-core`

제거 대상:

- fundamental skill의 `confidenceWeight >= MIN_CONFIDENCE_WEIGHT`
- news skill의 `confidenceWeight >= MIN_CONFIDENCE_WEIGHT`
- pattern 결과의 `filterPatterns`
- `MIN_CONFIDENCE_WEIGHT` 상수와 public export
- 하한 필터를 전제로 한 테스트와 현재 문서

차트 `selectSkills`에는 하한 필터가 이미 없으므로 동작을 유지하고, confidence와 gating이
서로 독립임을 테스트로 고정한다.

### 8.2 결과 후처리

패턴과 전략 결과에는 매칭된 skill의 `confidenceWeight`를 계속 첨부한다. 단, 값이
낮다는 이유로 결과를 제거하지 않는다. consumer는 결과 표시나 정렬에 confidence를
사용할 수 있지만 데이터 손실을 일으켜서는 안 된다.

`indicatorResults`의 응답 스키마는 이번 범위에서 confidence 필드를 추가하지 않는다.
보조지표의 confidence와 role은 프롬프트 해석 가이드에 사용한다.

---

## 9. Wyckoff 완전 제거

### 9.1 제거 대상

- `skills/strategies/wyckoff.md`
- 현재 카탈로그를 설명하는 `README.md`, `docs/product/DOMAIN.md`, `skills/CLAUDE.md`
- 현재 UI 진행 문구의 "와이코프"
- 현재 core 문서의 Wyckoff 카탈로그·always-on 설명
- 실제 기능명처럼 사용된 core prompt 테스트 fixture의 `Wyckoff Theory`

테스트 fixture는 `Generic Theory Strategy` 같은 중립 이름으로 교체한다. 테스트 의도인
미태깅/fail-open/always-on 동작은 유지한다.

### 9.2 유지 대상

과거 상태를 기록한 다음 문서는 수정하지 않는다.

- `docs/superpowers/specs/**`
- `docs/superpowers/plans/**`
- `CHANGELOG.md`
- 과거 QA 결과와 릴리스 기록

역사 문서의 Wyckoff 언급은 당시 설계와 동작을 설명하는 기록이다.

---

## 10. 저장소별 변경 경계

### 10.1 `siglens-core`

- `SkillUsageRole`과 `Skill.usageRoles` 공개 타입
- frontmatter `usage_roles` 파싱
- confidence level/label 공통 helper
- 차트/fundamental/news 프롬프트 공통 라벨 적용
- fundamental/news 하한 필터 제거
- 패턴 결과 하한 필터 제거
- `MIN_CONFIDENCE_WEIGHT`와 public export 제거
- 현재 정책 문서와 테스트 갱신
- 현재 Wyckoff 참조와 중립화가 필요한 fixture 정리

### 10.2 `siglens`

- 37개 `skills/indicators/*.md`에 승인된 `usage_roles` 추가
- runtime parser에 `usage_roles` 매핑
- validator에 indicator 전용 필수 규칙과 enum/중복/순서 검증 추가
- validator 테스트 추가
- `skills/strategies/wyckoff.md` 삭제
- home `SkillsShowcase`의 confidence tooltip 문구 교체(잘못된 "50% 미만 제외" 제거)와
  confidence bar 3등급 색상 적용
- 현재 정책 문서, 카탈로그 문서, UI 진행 문구 정리
- core 새 버전의 타입/상수 변경에 맞춘 consumer 수정

Skills 시스템의 타입과 프롬프트 정책은 `siglens-core`가 소유한다. `siglens`는 카탈로그와
consumer-side validation을 소유하며 core 정책을 재구현하지 않는다.

---

## 11. 로컬 overlay 통합 절차

정식 배포 대기로 인한 작업 병목을 줄이기 위해 다음 순서를 사용한다.

1. `siglens-core` 변경 구현 및 core 단위 테스트 완료
2. `siglens-core`에서 로컬 build 실행
3. 생성된 `dist`와 필요한 package metadata를
   `siglens/node_modules/@y0ngha/siglens-core`에 임시 overlay
4. overlay된 타입과 런타임을 사용해 `siglens` 구현
5. `siglens` validation, test, typecheck, build 수행
6. 양쪽 변경 검증 후 core 패키지 정식 배포
7. `siglens`의 core 의존 버전 갱신 및 `yarn install`
8. overlay가 없는 clean dependency 상태에서 최종 검증

가드레일:

- overlay 파일은 커밋하지 않는다.
- `package.json`의 정식 버전 의존성을 로컬 경로로 바꾸지 않는다.
- overlay 검증만으로 작업 완료를 선언하지 않는다.
- 최종 검증은 registry에서 설치한 정식 core 패키지를 기준으로 한다.
- overlay 대상과 실행 명령은 구현 계획에서 현재 패키지 build 산출물 구조를 확인해
  정확히 명시한다.

---

## 12. 테스트와 수용 기준

### 12.1 core 테스트

- 경계값 `0.0`, `0.49`, `0.5`, `0.79`, `0.8`, `1.0`의 등급
- 차트 프롬프트에서 Low skill 포함 및 `[Low Confidence]` 표시
- fundamental/news 프롬프트에서 Low skill 포함
- 모든 프롬프트에서 동일 confidence 라벨 사용
- indicator role 라벨 표시 및 canonical order
- 역할이 없는 외부 skill은 라벨 생략 후 정상 처리
- Low 패턴 결과가 후처리에서 유지됨
- confidence 변경이 gating 결과에 영향을 주지 않음
- 동일 입력에 byte-identical 프롬프트
- `MIN_CONFIDENCE_WEIGHT` public export 제거에 따른 export/type 테스트 갱신

### 12.2 siglens 테스트

- 모든 `indicator_guide`에 비어 있지 않은 `usage_roles` 존재
- 다른 skill type에 `usage_roles`가 있으면 실패
- unknown role, duplicate role, invalid order, non-array, empty array 실패
- runtime parser가 snake_case를 camelCase로 매핑
- 승인된 37개 초기값과 실제 frontmatter 일치
- Wyckoff 파일이 존재하지 않음
- 현재 카탈로그 문서와 UI에 Wyckoff 참조가 없음
- `SkillsShowcase` tooltip에 "제외" 문구가 없고 3등급 안내 문구가 표시됨
- confidence bar가 Low/Medium/High 경계(`0.49`/`0.5`/`0.79`/`0.8`)에서 올바른 색 토큰을 적용함
- `yarn validate:skills`, test, typecheck, build 통과

### 12.3 완료 조건

- 모든 `< 0.5` 런타임 하한 필터가 제거됨
- Low/Medium/High가 모든 skill prompt 경로에서 표시됨
- 37개 indicator guide에 승인된 역할이 적용됨
- Wyckoff가 현재 카탈로그와 사용자 노출에서 제거됨
- core 정식 패키지 설치 후 overlay 없이 siglens 최종 build가 통과함
- 현재 정책 문서가 실제 동작과 일치함

---

## 13. 위험과 완화

| 위험 | 완화 |
|---|---|
| Low 스킬 포함으로 프롬프트 증가 | 기존 category/gating을 유지하고 confidence 하한만 제거 |
| `0.0`이 비활성 값으로 계속 사용됨 | 작성 가이드에서 금지하고 Wyckoff를 실제 삭제 |
| role과 본문 설명 불일치 | 초기값 표를 source-of-truth로 사용하고 catalog test로 고정 |
| core/siglens parser drift | 동일 public union을 import하고 exhaustiveness test 적용 |
| overlay가 실제 배포 검증을 대체 | 정식 배포 후 clean install 검증을 완료 조건으로 강제 |
| public 상수 제거의 consumer break | 양쪽 저장소를 같은 변경 단위로 검증하고 core 선행 배포 |
| 과거 문서 대량 수정으로 역사 손상 | 현재 동작 문서만 수정하고 과거 specs/plans/changelog 유지 |

---

## 14. 최종 결정 요약

1. 기존 숫자형 `confidence_weight`를 유지한다.
2. confidence는 분석 반영 신뢰 수준이며 확률이 아니다.
3. 모든 스킬 유형에서 `< 0.5` 하한 필터를 제거한다.
4. Low/Medium/High 라벨을 모든 prompt 경로에서 사용한다.
5. `indicator_guide`에만 복수 `usage_roles`를 필수 적용한다.
6. core 타입은 호환성을 위해 `usageRoles?`로 둔다.
7. Wyckoff 전략은 비활성화가 아니라 완전히 제거한다.
8. home Skills Showcase의 잘못된 "50% 미만 제외" tooltip을 제거하고 3등급 안내·3색 bar로
   정책과 일치시킨다.
9. core를 먼저 구현하고 local build overlay로 siglens 통합 병목을 줄인다.
10. 최종 완료 판정은 정식 core 패키지 clean install 이후에만 한다.
