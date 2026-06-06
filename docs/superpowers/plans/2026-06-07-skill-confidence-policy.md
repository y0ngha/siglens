# Skill Confidence Policy & usage_roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** confidence_weight를 "분석 반영 신뢰 수준"으로 통일하고, 모든 스킬 유형에서 `<0.5` 하한 필터를 제거하며, `indicator_guide`에 `usage_roles`를 도입하고, Low/Medium/High 3등급을 모든 프롬프트·home UI에 일관 적용한다. Wyckoff 전략은 완전히 제거한다.

**Architecture:** cross-repo 작업이다. 정책·타입·프롬프트·후처리는 `siglens-core`(`/Users/y0ngha/Project/siglens-core`)가 소유하고, 스킬 카탈로그·consumer validation·home UI는 `siglens`가 소유한다. 구현 순서는 스펙 §11을 따른다: **Phase 1** core 구현+테스트 → **Phase 2** core local build를 siglens `node_modules`에 overlay 후 siglens 구현+검증 → **Phase 3** core 정식 배포(사용자) 후 clean install 최종 검증.

**Tech Stack:** TypeScript, vitest, Next.js 16, tsx(validate 스크립트), yarn. core는 tsc 빌드(`dist/`), dual entry(`index.ts` 서버 / `index.client.ts` 클라이언트).

**Spec:** `docs/superpowers/specs/2026-06-07-skill-confidence-policy-design.md`

**Branch:** `feat/skill-confidence-policy` (siglens, 이미 생성됨). core 작업은 core 레포에서 별도 브랜치 `feat/skill-confidence-policy`를 새로 만든다.

---

## File Structure

### siglens-core (Phase 1)

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/domain/types.ts` | 공개 도메인 타입 | `SkillUsageRole` union 추가, `Skill.usageRoles?` 추가 |
| `src/domain/analysis/confidenceLevel.ts` | **신규** — 등급/라벨 단일 helper | `ConfidenceLevel`, `getConfidenceLevel`, `confidenceLabel`, `roleLabel`, 경계 상수 소유 |
| `src/domain/indicators/constants.ts` | 지표/confidence 상수 | `MIN_CONFIDENCE_WEIGHT` 제거, `MEDIUM_CONFIDENCE_WEIGHT` 제거 |
| `src/domain/analysis/confidence.ts` | 응답 정규화·confidence 부착 | `filterPatterns` 제거, 패턴 필터 호출 제거 |
| `src/domain/analysis/fundamentalPrompt.ts` | fundamental 프롬프트 | confidence 하한 필터 제거, confidence 라벨 추가 |
| `src/domain/analysis/newsPrompt.ts` | news 프롬프트 | confidence 하한 필터 제거, confidence 라벨 추가 |
| `src/domain/analysis/prompt.ts` | 차트 프롬프트 | 로컬 `confidenceLabel` 삭제→helper 사용, `buildSkillBlock`에 role 라벨 |
| `src/infrastructure/skills/loader.ts` | core 런타임 frontmatter 파서 | `usage_roles` fail-safe 파싱+canonical 정규화 |
| `src/index.ts` / `src/index.client.ts` | 공개 barrel | `MIN_CONFIDENCE_WEIGHT` export 제거, `SkillUsageRole`·helper export 추가 |
| `src/__tests__/domain/analysis/*.test.ts` | core 테스트 | 필터 전제 제거, 라벨/role/등급 테스트, Wyckoff fixture 중립화 |
| `README.md` 등 core 현재 문서 | core 정책 문서 | Wyckoff·하한 필터·always-on 설명 갱신 |

### siglens (Phase 2)

| 파일 | 책임 | 변경 |
|---|---|---|
| `skills/indicators/*.md` (37개) | 지표 스킬 카탈로그 | `usage_roles` frontmatter 추가 (스펙 §6 값) |
| `skills/strategies/wyckoff.md` | wyckoff 전략 | **삭제** |
| `src/entities/skill/api.ts` | siglens 런타임 파서 | `toSkill`에 `usage_roles`→`usageRoles` 매핑 |
| `scripts/validate-skills.ts` | 빌드타임 카탈로그 validator | indicator usage_roles 필수/enum/중복/순서/non-array 검증 |
| `scripts/__tests__/validate-skills.test.ts` | validator 테스트 | 검증 규칙 테스트 |
| `src/widgets/home/SkillsShowcase.tsx` | home 스킬 쇼케이스 | tooltip 3등급 문구, bar 3색 |
| `src/widgets/home/__tests__/SkillsShowcase.test.tsx` | 쇼케이스 테스트 | 문구·색상 테스트 |
| `src/widgets/symbol-page/hooks/useAnalysisProgress.ts` | 분석 진행 문구 | "와이코프" 제거 |
| `README.md`, `docs/product/DOMAIN.md`, `skills/CLAUDE.md` | 카탈로그 문서 | Wyckoff·제외 정책 정리 |
| `package.json` | 의존성 | core 버전 갱신 (Phase 3) |

---

# Phase 1 — siglens-core

> 작업 디렉토리: `/Users/y0ngha/Project/siglens-core`. 모든 명령은 이 디렉토리 기준.

### Task 1: core 브랜치 생성 + 기준 확인

**Files:** 없음 (git/검증만)

- [ ] **Step 1: 브랜치 생성**

```bash
cd /Users/y0ngha/Project/siglens-core
git checkout main && git pull
git checkout -b feat/skill-confidence-policy
```

- [ ] **Step 2: 기준 그린 확인**

Run: `yarn test && yarn build`
Expected: 전체 PASS, build 성공. (변경 전 baseline)

---

### Task 2: `SkillUsageRole` 타입 + `Skill.usageRoles`

**Files:**
- Modify: `src/domain/types.ts:604-643`
- Test: `src/__tests__/domain/types.test.ts` (없으면 생성 생략 — 타입은 Task 5/6 helper 테스트에서 간접 검증)

- [ ] **Step 1: `SkillUsageRole` union과 `Skill.usageRoles` 추가**

`src/domain/types.ts`의 `SkillType` 정의(605-610) 바로 뒤, `Skill` interface(613) 앞에 추가:

```typescript
/**
 * Usage role of an `indicator_guide` skill — what analytical job the indicator
 * performs. Decoupled from `confidenceWeight` (which is *how much* to trust the
 * interpretation, not *what kind* of interpretation). Canonical order:
 * signal → confirmation → regime → measurement → risk.
 */
export type SkillUsageRole =
    | 'signal'
    | 'confirmation'
    | 'regime'
    | 'measurement'
    | 'risk';
```

`Skill` interface 안, `smcFullGuide?: boolean;`(642) 뒤에 추가:

```typescript
    /**
     * Usage roles for `indicator_guide` skills (e.g. `[signal, confirmation]`).
     * Optional in the public type for compatibility with external/older
     * catalogs; the siglens catalog validator enforces it as required on
     * `indicator_guide`. Stored in canonical order; the loader normalizes
     * invalid/missing values to `undefined` (fail-safe).
     */
    usageRoles?: SkillUsageRole[];
```

- [ ] **Step 2: 타입 컴파일 확인**

Run: `yarn build`
Expected: 성공 (아직 소비처 없음).

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(types): add SkillUsageRole and Skill.usageRoles"
```

---

### Task 3: confidence 등급/라벨 단일 helper (`confidenceLevel.ts`)

**Files:**
- Create: `src/domain/analysis/confidenceLevel.ts`
- Test: `src/__tests__/domain/analysis/confidenceLevel.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/__tests__/domain/analysis/confidenceLevel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    getConfidenceLevel,
    confidenceLabel,
    roleLabel,
    MEDIUM_CONFIDENCE_THRESHOLD,
} from '@/domain/analysis/confidenceLevel';
import { HIGH_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';

describe('getConfidenceLevel — boundary values', () => {
    it.each([
        [0.0, 'low'],
        [0.49, 'low'],
        [0.5, 'medium'],
        [0.79, 'medium'],
        [0.8, 'high'],
        [1.0, 'high'],
    ] as const)('weight %f → %s', (weight, level) => {
        expect(getConfidenceLevel(weight)).toBe(level);
    });

    it('thresholds are 0.5 and HIGH_CONFIDENCE_WEIGHT', () => {
        expect(MEDIUM_CONFIDENCE_THRESHOLD).toBe(0.5);
        expect(HIGH_CONFIDENCE_WEIGHT).toBe(0.8);
    });
});

describe('confidenceLabel', () => {
    it.each([
        [0.0, '[Low Confidence]'],
        [0.5, '[Medium Confidence]'],
        [0.8, '[High Confidence]'],
    ] as const)('weight %f → %s', (weight, label) => {
        expect(confidenceLabel(weight)).toBe(label);
    });
});

describe('roleLabel — canonical order, indicator-only', () => {
    it('returns empty string for undefined/empty roles', () => {
        expect(roleLabel(undefined)).toBe('');
        expect(roleLabel([])).toBe('');
    });

    it('orders roles canonically regardless of input order', () => {
        expect(roleLabel(['confirmation', 'signal'])).toBe(
            ' [Roles: Signal, Confirmation]'
        );
        expect(roleLabel(['risk', 'measurement', 'regime'])).toBe(
            ' [Roles: Regime, Measurement, Risk]'
        );
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/confidenceLevel.test.ts`
Expected: FAIL — "Cannot find module '@/domain/analysis/confidenceLevel'".

- [ ] **Step 3: helper 구현**

`src/domain/analysis/confidenceLevel.ts`:

```typescript
import { HIGH_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
import type { SkillUsageRole } from '@/domain/types';

/**
 * Low/Medium 경계. 제거된 `MIN_CONFIDENCE_WEIGHT`(하한 *필터*)와 같은 0.5 값이지만
 * 의미가 다르다 — 포함/제외가 아니라 표시 *등급* 경계다. 등급 경계는 이 모듈이
 * 단일 소유한다(스펙 §4.2). Medium/High 경계는 `HIGH_CONFIDENCE_WEIGHT`를 재사용한다.
 */
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * confidenceWeight를 표시 등급으로 변환한다. 포함 여부를 결정하지 않는다 —
 * 모든 등급(Low 포함)이 프롬프트/UI에 표시된다.
 */
export function getConfidenceLevel(weight: number): ConfidenceLevel {
    if (weight >= HIGH_CONFIDENCE_WEIGHT) return 'high';
    if (weight >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
    return 'low';
}

const LEVEL_LABEL: Record<ConfidenceLevel, string> = {
    low: '[Low Confidence]',
    medium: '[Medium Confidence]',
    high: '[High Confidence]',
};

/** 프롬프트용 confidence 라벨. 모든 스킬 유형이 같은 라벨을 쓴다. */
export function confidenceLabel(weight: number): string {
    return LEVEL_LABEL[getConfidenceLevel(weight)];
}

const ROLE_ORDER: readonly SkillUsageRole[] = [
    'signal',
    'confirmation',
    'regime',
    'measurement',
    'risk',
];

const ROLE_LABEL: Record<SkillUsageRole, string> = {
    signal: 'Signal',
    confirmation: 'Confirmation',
    regime: 'Regime',
    measurement: 'Measurement',
    risk: 'Risk',
};

/**
 * indicator_guide의 usage role 라벨을 canonical order로 결정적으로 만든다.
 * 역할이 없으면 빈 문자열을 반환해 라벨을 생략한다(외부/구버전 스킬 fail-safe).
 * 선행 공백을 포함하므로 `### Name [Conf]${roleLabel(...)}` 형태로 직접 이어붙인다.
 */
export function roleLabel(roles: SkillUsageRole[] | undefined): string {
    if (!roles || roles.length === 0) return '';
    const ordered = ROLE_ORDER.filter(r => roles.includes(r));
    if (ordered.length === 0) return '';
    return ` [Roles: ${ordered.map(r => ROLE_LABEL[r]).join(', ')}]`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/confidenceLevel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/confidenceLevel.ts src/__tests__/domain/analysis/confidenceLevel.test.ts
git commit -m "feat(analysis): add single-source confidence level/label + role helper"
```

---

### Task 4: 패턴 결과 하한 필터 제거 (`confidence.ts`)

**Files:**
- Modify: `src/domain/analysis/confidence.ts:1-4,105-108,196`
- Test: `src/__tests__/domain/analysis/confidence.test.ts`

- [ ] **Step 1: Low 패턴 유지를 검증하는 테스트 추가/수정**

`src/__tests__/domain/analysis/confidence.test.ts`에 추가 (기존 `filterPatterns`/MIN 의존 케이스는 Step 4에서 정리):

```typescript
describe('enrichAnalysisWithConfidence — low-confidence patterns are kept', () => {
    it('keeps a pattern whose matched skill confidence is below 0.5', () => {
        const skills = [
            {
                name: 'Low Pattern',
                description: '',
                type: 'pattern' as const,
                pattern: 'low_pattern',
                indicators: [],
                confidenceWeight: 0.2,
                content: '',
            },
        ];
        const raw = {
            patternSummaries: [
                {
                    patternName: 'Low Pattern',
                    skillName: 'Low Pattern',
                    sentiment: 'bullish',
                    summary: 's',
                },
            ],
        };
        const result = enrichAnalysisWithConfidence(raw, skills);
        expect(result.patternSummaries).toHaveLength(1);
        expect(result.patternSummaries[0].confidenceWeight).toBe(0.2);
    });
});
```

(`enrichAnalysisWithConfidence` import가 파일 상단에 없으면 추가.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/confidence.test.ts -t "low-confidence patterns"`
Expected: FAIL — 길이 0 (현재 `filterPatterns`가 0.2를 제거).

- [ ] **Step 3: `filterPatterns` 제거**

`src/domain/analysis/confidence.ts`에서:

1. line 105-108 `filterPatterns` 함수 전체 삭제.
2. line 196 `patternSummaries: filterPatterns(enrichedPatterns),` → `patternSummaries: enrichedPatterns,`
3. line 1-4의 import에서 `MIN_CONFIDENCE_WEIGHT`를 제거하고 `UNMATCHED_SKILL_CONFIDENCE_WEIGHT`만 남긴다:

```typescript
import { UNMATCHED_SKILL_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
```

4. line 122-125 JSDoc의 "3. `patternSummaries` are filtered to those with `confidenceWeight >= MIN_CONFIDENCE_WEIGHT`." 항목을 삭제하고 이후 번호를 당긴다.

- [ ] **Step 4: MIN 의존 기존 테스트 정리**

`confidence.test.ts`에서 `filterPatterns` import/직접 호출 케이스와 "패턴이 하한으로 제거됨"을 단언하는 케이스를 제거하거나 "유지됨"으로 반전한다. `MIN_CONFIDENCE_WEIGHT` / `MEDIUM_CONFIDENCE_WEIGHT` import가 있으면 제거하고, 해당 값을 쓰던 곳은 리터럴(예: `0.7`)로 교체한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/confidence.test.ts`
Expected: PASS (전체 파일).

- [ ] **Step 6: Commit**

```bash
git add src/domain/analysis/confidence.ts src/__tests__/domain/analysis/confidence.test.ts
git commit -m "feat(analysis): drop pattern confidence floor filter"
```

---

### Task 5: fundamental/news 하한 필터 제거 + confidence 라벨

**Files:**
- Modify: `src/domain/analysis/fundamentalPrompt.ts:3,15-22,101-107`
- Modify: `src/domain/analysis/newsPrompt.ts:3,11-17,109-115`
- Test: `src/__tests__/domain/analysis/fundamentalPrompt.test.ts`, `src/__tests__/domain/analysis/newsPrompt.test.ts`

- [ ] **Step 1: 실패 테스트 — Low fundamental 스킬 포함 + 라벨**

`fundamentalPrompt.test.ts`에 추가:

```typescript
it('includes a low-confidence fundamental skill with a [Low Confidence] label', () => {
    const skills = [
        {
            name: 'Deep Value Lens',
            description: '',
            type: 'pattern' as const,
            category: 'fundamental' as const,
            indicators: [],
            confidenceWeight: 0.3,
            content: 'value body',
        },
    ];
    const prompt = buildFundamentalAnalysisPrompt('AAPL', SNAPSHOT_FIXTURE, skills);
    expect(prompt).toContain('### Deep Value Lens [Low Confidence]');
    expect(prompt).toContain('value body');
});
```

(`SNAPSHOT_FIXTURE`는 해당 테스트 파일에 이미 있는 스냅샷 fixture를 재사용. 없으면 기존 테스트가 쓰는 fixture 이름으로 교체.)

`newsPrompt.test.ts`에 동등한 케이스 추가 (`category: 'news'`, `buildNewsAnalysisPrompt('AAPL', 'Apple Inc.', [], [], skills)`, `### <name> [Low Confidence]` 단언).

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/fundamentalPrompt.test.ts src/__tests__/domain/analysis/newsPrompt.test.ts`
Expected: FAIL — Low 스킬이 필터링되어 미포함, 라벨 없음.

- [ ] **Step 3: fundamentalPrompt.ts 수정**

line 3 import 교체:

```typescript
import { confidenceLabel } from '@/domain/analysis/confidenceLevel';
```

(`MIN_CONFIDENCE_WEIGHT` import 줄 삭제.)

line 15-22 `filterFundamentalSkills` 교체:

```typescript
/** Filter skills to the fundamental category. Confidence is a display weight, not an inclusion gate. */
function filterFundamentalSkills(skills: readonly Skill[]): Skill[] {
    return skills.filter(s => s.category === 'fundamental');
}
```

line 104-106 skill 블록 라벨 추가:

```typescript
                  .map(s => `### ${s.name} ${confidenceLabel(s.confidenceWeight)}\n${s.content}`)
```

line 74-75 JSDoc의 `and \`confidenceWeight >= MIN_CONFIDENCE_WEIGHT\`` 문구 삭제.

- [ ] **Step 4: newsPrompt.ts 수정**

line 3 import를 `confidenceLabel`로 교체(동일). line 11-17 `filterNewsSkills`를 category-only로 교체:

```typescript
/** Filter skills to the news category. Confidence is a display weight, not an inclusion gate. */
function filterNewsSkills(skills: readonly Skill[]): Skill[] {
    return skills.filter(s => s.category === 'news');
}
```

line 112-114 skill 블록 라벨 추가:

```typescript
                  .map(s => `### ${s.name} ${confidenceLabel(s.confidenceWeight)}\n${s.content}`)
```

line 59-61 JSDoc의 `and \`confidenceWeight >= MIN_CONFIDENCE_WEIGHT\`` 문구 삭제.

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/fundamentalPrompt.test.ts src/__tests__/domain/analysis/newsPrompt.test.ts`
Expected: PASS. (기존 byte-identical/스냅샷 테스트가 있으면 라벨 추가로 깨질 수 있으니 함께 갱신.)

- [ ] **Step 6: Commit**

```bash
git add src/domain/analysis/fundamentalPrompt.ts src/domain/analysis/newsPrompt.ts src/__tests__/domain/analysis/fundamentalPrompt.test.ts src/__tests__/domain/analysis/newsPrompt.test.ts
git commit -m "feat(analysis): drop fundamental/news confidence floor, add confidence labels"
```

---

### Task 6: 차트 프롬프트 — 3등급 라벨 + role 라벨 (`prompt.ts`)

**Files:**
- Modify: `src/domain/analysis/prompt.ts:1177-1183` (+ import 구역)
- Test: `src/__tests__/domain/analysis/prompt.test.ts`

- [ ] **Step 1: 실패 테스트 — Low 차트 스킬 라벨 + indicator role 라벨**

`prompt.test.ts`에 추가:

```typescript
it('labels a low-confidence indicator guide with [Low Confidence] and its roles', () => {
    const skills = [
        {
            name: 'MACD-V Signal Guide',
            description: '',
            type: 'indicator_guide' as const,
            indicators: [],
            confidenceWeight: 0.2,
            content: 'macd-v body',
            usageRoles: ['confirmation'] as const,
        },
    ];
    const prompt = buildAnalysisPrompt('AAPL', 'Apple Inc.', BARS_FIXTURE, INDICATORS_FIXTURE, skills);
    expect(prompt).toContain('### MACD-V Signal Guide [Low Confidence] [Roles: Confirmation]');
    expect(prompt).toContain('macd-v body');
});
```

(`BARS_FIXTURE`/`INDICATORS_FIXTURE`는 파일 내 기존 fixture 이름으로 교체. `usageRoles`가 `readonly` 튜플이라 타입 에러가 나면 `['confirmation'] as SkillUsageRole[]`로 변경하고 `SkillUsageRole`를 import.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/prompt.test.ts -t "low-confidence indicator guide"`
Expected: FAIL — 현재 `[Medium Confidence]`로 라벨, role 라벨 없음.

- [ ] **Step 3: prompt.ts 로컬 라벨 삭제 → helper 사용 + role 라벨**

line 1177-1180의 로컬 `confidenceLabel` 함수 전체를 삭제한다. import 구역(58 근처 `selectSkills` import 옆)에 추가:

```typescript
import { confidenceLabel, roleLabel } from '@/domain/analysis/confidenceLevel';
```

`HIGH_CONFIDENCE_WEIGHT` import가 로컬 confidenceLabel에서만 쓰였다면 prompt.ts의 import에서 제거(다른 사용처가 있으면 유지 — grep으로 확인). line 1182-1183 `buildSkillBlock` 교체:

```typescript
const buildSkillBlock = (skill: Skill): string => {
    const roles = skill.type === 'indicator_guide' ? roleLabel(skill.usageRoles) : '';
    return `### ${skill.name} ${confidenceLabel(skill.confidenceWeight)}${roles}\n${skill.content}`;
};
```

- [ ] **Step 4: 테스트 통과 + 결정성 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/prompt.test.ts`
Expected: PASS. byte-identical/snapshot 프롬프트 테스트가 라벨 변경(Medium→Low 등)으로 깨지면 새 라벨에 맞게 기대값을 갱신한다(동일 입력 결정성 자체는 유지).

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/prompt.ts src/__tests__/domain/analysis/prompt.test.ts
git commit -m "feat(analysis): chart prompt uses shared 3-tier label + indicator role label"
```

---

### Task 7: `MIN_CONFIDENCE_WEIGHT` / `MEDIUM_CONFIDENCE_WEIGHT` 상수 제거 + barrel export 정리

**Files:**
- Modify: `src/domain/indicators/constants.ts:178-183`
- Modify: `src/index.ts:226-231,495-505`
- Modify: `src/index.client.ts:181-186,326-327`
- Test: `src/__tests__` (export/type 테스트가 있으면 갱신)

- [ ] **Step 1: 잔존 사용처 0 확인**

Run: `grep -rn "MIN_CONFIDENCE_WEIGHT\|MEDIUM_CONFIDENCE_WEIGHT" src | grep -v "constants.ts"`
Expected: 빈 출력. (남아 있으면 그 파일을 먼저 정리 — Task 3~6에서 모두 처리됐어야 함.)

- [ ] **Step 2: 상수 삭제**

`src/domain/indicators/constants.ts`에서 line 180 `export const MEDIUM_CONFIDENCE_WEIGHT = 0.7;`와 line 181 `export const MIN_CONFIDENCE_WEIGHT = 0.5;`를 삭제한다. `HIGH_CONFIDENCE_WEIGHT = 0.8`(178)와 `UNMATCHED_SKILL_CONFIDENCE_WEIGHT = 0`(183)은 유지한다.

- [ ] **Step 3: barrel export 정리**

`src/index.ts`: 226-231 export 블록에서 `MIN_CONFIDENCE_WEIGHT` 줄을 제거한다(`HIGH_CONFIDENCE_WEIGHT`는 유지). 495-505 타입 export 블록에서 `SkillType` 옆에 `SkillUsageRole`을 추가한다. confidence helper(`getConfidenceLevel`, `confidenceLabel`, `ConfidenceLevel`)를 공개해야 하는지는 consumer 필요에 따른다 — siglens는 프롬프트를 직접 만들지 않으므로 **타입 `SkillUsageRole`만 공개**하고 helper는 core 내부로 둔다(YAGNI). home UI는 자체 경계 상수를 쓴다(Task 16).

`src/index.client.ts`: 181-186에서 `MIN_CONFIDENCE_WEIGHT` 제거, 326-327 타입 export에 `SkillUsageRole` 추가.

- [ ] **Step 4: 빌드 + 전체 테스트**

Run: `yarn build && yarn test`
Expected: 성공/PASS. export 스냅샷 테스트가 있으면 `MIN_CONFIDENCE_WEIGHT` 제거·`SkillUsageRole` 추가에 맞춰 갱신.

- [ ] **Step 5: Commit**

```bash
git add src/domain/indicators/constants.ts src/index.ts src/index.client.ts src/__tests__
git commit -m "refactor(core): remove MIN/MEDIUM_CONFIDENCE_WEIGHT, export SkillUsageRole"
```

---

### Task 8: core loader — `usage_roles` fail-safe 파싱

**Files:**
- Modify: `src/infrastructure/skills/loader.ts:4-15,305-324`
- Test: `src/__tests__/infrastructure/skills/loader.test.ts`

- [ ] **Step 1: 실패 테스트 — 정상/비정상 usage_roles**

`loader.test.ts`에 추가 (이 파일이 실제 `.md`를 fixture로 읽는지, 인메모리 파싱을 쓰는지 확인 후 기존 패턴에 맞춤). core loader의 `toSkill`은 모듈 비공개이므로, fixture `.md`를 통한 `loadSkills()` 경로로 테스트한다. 기존 테스트가 `skills/` fixture를 쓰면 임시 fixture를 추가하고, 인메모리라면 그 헬퍼를 쓴다. 검증 의도:

```typescript
// 정상: canonical order로 정규화되어 노출
//   usage_roles: [confirmation, signal] → usageRoles: ['signal','confirmation']
// 비정상(fail-safe → usageRoles: undefined):
//   - unknown role 포함
//   - 빈 배열
//   - 배열이 아님
//   - 중복
```

(기존 loader.test.ts의 fixture 구성 방식을 그대로 따른다 — 본 plan은 검증 의도와 기대값을 명시하고, 실행자는 파일의 기존 fixture 패턴에 맞춰 케이스를 작성한다.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/__tests__/infrastructure/skills/loader.test.ts -t "usage_roles"`
Expected: FAIL — `usageRoles`가 항상 undefined.

- [ ] **Step 3: loader.ts 파싱 추가**

line 4-15 type import에 `SkillUsageRole` 추가:

```typescript
    SkillUsageRole,
```

`toSkill`(305) 앞에 정규화 helper 추가:

```typescript
const USAGE_ROLE_ORDER: readonly SkillUsageRole[] = [
    'signal',
    'confirmation',
    'regime',
    'measurement',
    'risk',
];

/**
 * Normalize a frontmatter `usage_roles` value to canonical-ordered roles.
 * Fail-safe: returns `undefined` for any malformed input (non-array, empty,
 * unknown role, duplicates) so external/older catalogs never crash the loader.
 * The siglens build-time validator rejects the same malformed states.
 */
const parseUsageRoles = (raw: unknown): SkillUsageRole[] | undefined => {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const seen = new Set<string>();
    for (const r of raw) {
        if (typeof r !== 'string') return undefined;
        if (seen.has(r)) return undefined;
        if (!(USAGE_ROLE_ORDER as readonly string[]).includes(r)) return undefined;
        seen.add(r);
    }
    return USAGE_ROLE_ORDER.filter(r => seen.has(r));
};
```

`toSkill` 반환 객체(305-324)의 `smcFullGuide` 뒤에 추가:

```typescript
    usageRoles: parseUsageRoles(data.usage_roles),
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run src/__tests__/infrastructure/skills/loader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/skills/loader.ts src/__tests__/infrastructure/skills/loader.test.ts
git commit -m "feat(loader): parse usage_roles with fail-safe canonical normalization"
```

---

### Task 9: Wyckoff 테스트 fixture 중립화

**Files:**
- Modify: `src/__tests__/domain/analysis/prompt.test.ts`

- [ ] **Step 1: fixture 식별**

Run: `grep -n "Wyckoff\|wyckoff" src/__tests__/domain/analysis/prompt.test.ts`
Expected: `Wyckoff Theory` 등 fixture 이름 사용 라인 목록.

- [ ] **Step 2: 중립 이름으로 교체**

`Wyckoff Theory`(및 관련 wyckoff 식별자)를 `Generic Theory Strategy`로 일괄 교체한다. 미태깅/fail-open/always-on 동작을 검증하는 테스트 *의도*는 유지하고, 실제 카탈로그 기능명이 아닌 중립 이름만 바꾼다. 다른 strategy fixture 이름과 충돌하지 않는지 확인.

- [ ] **Step 3: 테스트 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/prompt.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/domain/analysis/prompt.test.ts
git commit -m "test(prompt): neutralize Wyckoff fixture to Generic Theory Strategy"
```

---

### Task 10: core 현재 문서 갱신

**Files:**
- Modify: core `README.md` 및 현재 정책을 설명하는 문서(Wyckoff 카탈로그/always-on, `<0.5` 하한 필터 설명)

- [ ] **Step 1: 현재 문서의 대상 식별**

Run: `grep -rln "MIN_CONFIDENCE_WEIGHT\|0\.5.*제외\|Wyckoff\|wyckoff\|always-on" README.md docs 2>/dev/null`
Expected: 갱신 대상 목록. (과거 기록 — specs/plans/CHANGELOG — 는 §9.2/스펙대로 **수정하지 않는다**.)

- [ ] **Step 2: 현재 동작에 맞게 수정**

- `<0.5` 스킬이 프롬프트에서 제외된다는 설명 → "confidence는 표시 등급이며 포함을 결정하지 않는다"로 교체.
- Wyckoff를 현재 카탈로그/always-on 예시로 드는 서술 제거.
- confidence 라벨이 Low/Medium/High 3등급임을 반영.

- [ ] **Step 3: Commit**

```bash
git add README.md docs
git commit -m "docs(core): align confidence/skill policy docs with new behavior"
```

---

### Task 11: Phase 1 게이트 — core 전체 검증

**Files:** 없음

- [ ] **Step 1: 전체 테스트 + 빌드 + 린트**

Run: `yarn test && yarn build && yarn lint`
Expected: 전부 통과. 잔존 `MIN_CONFIDENCE_WEIGHT`/`MEDIUM_CONFIDENCE_WEIGHT`/현재 Wyckoff 참조 0.

- [ ] **Step 2: 잔존 참조 최종 확인**

Run: `grep -rn "MIN_CONFIDENCE_WEIGHT\|MEDIUM_CONFIDENCE_WEIGHT" src; grep -rn "filterPatterns" src`
Expected: 빈 출력.

- [ ] **Step 3: push (PR은 Phase 3에서)**

```bash
git push -u origin feat/skill-confidence-policy
```

> **사용자 확인 지점:** core 정식 publish는 사용자가 직접 한다(Phase 3). Phase 2는 아직 배포 전 local build overlay로 진행한다.

---

# Phase 2 — siglens (local build overlay)

> 작업 디렉토리: `/Users/y0ngha/Project/siglens`, 브랜치 `feat/skill-confidence-policy`.

### Task 12: core local build → siglens overlay

**Files:** 없음 (overlay는 커밋하지 않음 — 스펙 §11 가드레일)

- [ ] **Step 1: core dist 빌드**

```bash
cd /Users/y0ngha/Project/siglens-core
yarn build
ls dist/index.d.ts dist/index.client.d.ts   # 산출물 확인
```

- [ ] **Step 2: siglens node_modules에 overlay**

core 패키지의 실제 published 파일 범위를 확인 후 dist + package.json을 복사한다:

```bash
cd /Users/y0ngha/Project/siglens-core
node -e "console.log(JSON.stringify(require('./package.json').files))"   # 배포 포함 경로 확인
DEST=/Users/y0ngha/Project/siglens/node_modules/@y0ngha/siglens-core
rm -rf "$DEST/dist" && cp -R dist "$DEST/dist"
cp package.json "$DEST/package.json"
```

(core `package.json`의 `files`/`exports`에 dist 외 포함 항목이 있으면 함께 복사. 본 plan은 dist+package.json을 기준으로 하며, 실행 시 `files` 출력으로 정확한 범위를 확정한다.)

- [ ] **Step 3: overlay 타입 확인**

```bash
cd /Users/y0ngha/Project/siglens
grep -n "SkillUsageRole\|MIN_CONFIDENCE_WEIGHT" node_modules/@y0ngha/siglens-core/dist/index.d.ts
```
Expected: `SkillUsageRole` 존재, `MIN_CONFIDENCE_WEIGHT` 부재.

> 이후 Task들의 typecheck/build는 이 overlay된 타입을 기준으로 한다. overlay는 절대 커밋하지 않는다.

---

### Task 13: 37개 indicator `.md`에 `usage_roles` 추가

**Files:**
- Modify: `skills/indicators/*.md` (37개)

- [ ] **Step 1: frontmatter 추가**

각 파일의 frontmatter(`---` 블록) 안에 `usage_roles` 키를 한 줄 추가한다. 위치는 `confidence_weight:` 줄 바로 아래로 통일한다. 값은 스펙 §6 표를 그대로 사용한다(임의 재분류 금지). 형식:

```yaml
usage_roles: [signal, confirmation]
```

전체 매핑(스펙 §6):

```
adx                   [confirmation, regime]
atr                   [confirmation, measurement, risk]
bollinger-bands       [signal, confirmation, measurement]
bollinger-percent-b   [signal, confirmation, measurement]
buy-sell-volume       [confirmation, measurement]
cci                   [signal, confirmation]
chandelier-exit       [regime, risk]
cmf                   [signal, confirmation, measurement]
connors-rsi           [signal, confirmation]
dmi                   [signal, confirmation, regime]
donchian-channel      [signal, confirmation, measurement]
elder-impulse         [confirmation, regime]
elder-ray             [signal, confirmation]
ema                   [signal, confirmation, regime]
ewma-volatility       [measurement, risk]
force-index           [signal, confirmation]
hurst                 [regime]
ichimoku-cloud        [signal, confirmation, regime]
keltner-channel       [signal, confirmation, measurement]
ma                    [signal, confirmation, regime]
macd-v                [confirmation]
macd                  [signal, confirmation]
mfi                   [signal, confirmation, measurement]
obv                   [confirmation, measurement]
parabolic-sar         [signal, confirmation, risk]
regression-r2         [regime]
rsi                   [signal, confirmation]
smart-money-concepts  [signal, confirmation, regime]
squeeze-momentum      [signal, confirmation, measurement]
stochastic-rsi        [signal, confirmation]
stochastic            [signal, confirmation]
supertrend            [signal, confirmation, risk]
variance-ratio        [regime]
volume-profile        [confirmation, measurement]
vwap                  [signal, confirmation, measurement]
williams-r            [signal, confirmation]
yang-zhang            [measurement, risk]
```

- [ ] **Step 2: 누락/오타 검증**

Run: `for f in skills/indicators/*.md; do grep -q "usage_roles:" "$f" || echo "MISSING: $f"; done`
Expected: 빈 출력 (37개 모두 보유).

- [ ] **Step 3: Commit**

```bash
git add skills/indicators
git commit -m "feat(skills): add usage_roles to all 37 indicator guides"
```

---

### Task 14: Wyckoff 삭제 + 분석 진행 문구 정리

**Files:**
- Delete: `skills/strategies/wyckoff.md`
- Modify: `src/widgets/symbol-page/hooks/useAnalysisProgress.ts:25`

- [ ] **Step 1: wyckoff.md 삭제**

```bash
git rm skills/strategies/wyckoff.md
```

- [ ] **Step 2: 진행 문구에서 "와이코프" 제거**

`useAnalysisProgress.ts:25`를 교체:

```typescript
    '엘리어트 파동, 피보나치 등 다양한 전략을 데이터에 적용하고 있어요.',
```

- [ ] **Step 3: 잔존 참조 확인**

Run: `grep -rni "wyckoff\|와이코프" src skills README.md docs/product docs/architecture skills/CLAUDE.md 2>/dev/null`
Expected: 현재 카탈로그/UI/문서에 0 (과거 specs/plans/CHANGELOG 제외).

- [ ] **Step 4: Commit**

```bash
git add -A skills/strategies src/widgets/symbol-page/hooks/useAnalysisProgress.ts
git commit -m "feat(skills): remove Wyckoff strategy and its progress-copy mention"
```

---

### Task 15: siglens 런타임 파서 — `usage_roles` 매핑

**Files:**
- Modify: `src/entities/skill/api.ts:4-14,415-433`
- Test: `src/entities/skill/__tests__/api.test.ts` (또는 `apiBranches.test.ts`)

- [ ] **Step 1: 실패 테스트 — toSkill usageRoles 매핑**

`src/entities/skill/__tests__/api.test.ts`의 기존 frontmatter 파싱 테스트 패턴을 따라, indicator `.md`를 로드했을 때 `usageRoles`가 camelCase로 매핑되고 canonical order로 정규화되는지 검증하는 케이스를 추가한다. (api.ts는 실제 `skills/`를 읽으므로, 기존 테스트가 디렉토리를 읽는지/모킹하는지 확인 후 맞춘다.) 검증 의도:

```
usage_roles: [confirmation, signal]  →  skill.usageRoles === ['signal','confirmation']
unknown/empty/non-array/duplicate    →  skill.usageRoles === undefined
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/entities/skill/__tests__/api.test.ts -t "usageRoles"`
Expected: FAIL.

- [ ] **Step 3: api.ts에 파싱 추가**

line 4-14 type import에 `SkillUsageRole` 추가. `SKILL_TYPES`(170) 근처에 core loader와 동일한 정규화 helper를 추가:

```typescript
const USAGE_ROLE_ORDER = [
    'signal',
    'confirmation',
    'regime',
    'measurement',
    'risk',
] as const satisfies readonly SkillUsageRole[];

/**
 * Mirror of core loader's parseUsageRoles. Fail-safe: malformed input
 * (non-array, empty, unknown role, duplicate) → undefined. The build-time
 * validator (scripts/validate-skills.ts) rejects the same malformed states.
 */
const parseUsageRoles = (raw: unknown): SkillUsageRole[] | undefined => {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const seen = new Set<string>();
    for (const r of raw) {
        if (typeof r !== 'string') return undefined;
        if (seen.has(r)) return undefined;
        if (!(USAGE_ROLE_ORDER as readonly string[]).includes(r)) return undefined;
        seen.add(r);
    }
    return USAGE_ROLE_ORDER.filter(r => seen.has(r));
};
```

`toSkill`(415-433) 반환 객체의 `smcFullGuide`(432) 뒤에 추가:

```typescript
    usageRoles: parseUsageRoles(data.usage_roles),
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run src/entities/skill/__tests__/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/skill/api.ts src/entities/skill/__tests__
git commit -m "feat(skill): map usage_roles to usageRoles in runtime parser"
```

---

### Task 16: validator — indicator `usage_roles` 강제

**Files:**
- Modify: `scripts/validate-skills.ts`
- Test: `scripts/__tests__/validate-skills.test.ts`

- [ ] **Step 1: validate-skills.ts의 현재 구조 확인**

Run: `grep -n "indicator_guide\|function\|export\|VALID_STATE_PAIRS\|throw\|error" scripts/validate-skills.ts | head -40`
Expected: 검증 함수 구조 파악 (지표별 frontmatter를 어떻게 검사하는지).

- [ ] **Step 2: 실패 테스트 작성**

`scripts/__tests__/validate-skills.test.ts`에 추가 (기존 테스트의 호출 방식에 맞춤):

```typescript
// indicator_guide:
//   - usage_roles 누락 → 실패
//   - 빈 배열 → 실패
//   - 배열 아님 → 실패
//   - unknown role 포함 → 실패
//   - duplicate role → 실패
//   - canonical order 위반(e.g. [confirmation, signal]) → 실패
//   - 올바른 [signal, confirmation] → 통과
// 다른 skill type:
//   - usage_roles 존재 → 실패 (indicator_guide 전용)
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `yarn vitest run scripts/__tests__/validate-skills.test.ts -t "usage_roles"`
Expected: FAIL.

- [ ] **Step 4: validator 규칙 구현**

`scripts/validate-skills.ts`에 검증 추가(기존 검증 helper 패턴을 따름):

```typescript
const USAGE_ROLE_ORDER = [
    'signal',
    'confirmation',
    'regime',
    'measurement',
    'risk',
] as const;

type UsageRole = (typeof USAGE_ROLE_ORDER)[number];

/** Validate `usage_roles` per skill type. Returns an error message or null. */
function validateUsageRoles(
    type: string | undefined,
    raw: unknown
): string | null {
    if (type !== 'indicator_guide') {
        return raw !== undefined
            ? 'usage_roles is only allowed on type: indicator_guide'
            : null;
    }
    if (!Array.isArray(raw) || raw.length === 0) {
        return 'indicator_guide requires a non-empty usage_roles array';
    }
    const seen: string[] = [];
    for (const r of raw) {
        if (typeof r !== 'string' || !(USAGE_ROLE_ORDER as readonly string[]).includes(r)) {
            return `invalid usage_role: ${String(r)}`;
        }
        if (seen.includes(r)) return `duplicate usage_role: ${r}`;
        seen.push(r);
    }
    // canonical order must hold
    const canonical = USAGE_ROLE_ORDER.filter(o => seen.includes(o));
    if (canonical.join(',') !== seen.join(',')) {
        return `usage_roles must be in canonical order: [${canonical.join(', ')}]`;
    }
    return null;
}
```

이 함수를 각 스킬 검증 루프에서 호출하고, 반환된 에러 메시지를 기존 에러 수집 메커니즘(throw 또는 errors 배열)에 연결한다. 파싱은 frontmatter raw `usage_roles`(snake_case)를 그대로 읽어야 한다 — camelCase 매핑 이전 단계.

- [ ] **Step 5: 테스트 통과 + 실제 카탈로그 검증**

Run: `yarn vitest run scripts/__tests__/validate-skills.test.ts && yarn validate:skills`
Expected: 테스트 PASS, `yarn validate:skills`가 37개 실제 frontmatter를 통과(Task 13 값이 canonical order이므로).

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-skills.ts scripts/__tests__/validate-skills.test.ts
git commit -m "feat(validate): enforce usage_roles rules on indicator_guide skills"
```

---

### Task 17: home Skills Showcase — 3등급 tooltip + 3색 bar

**Files:**
- Modify: `src/widgets/home/SkillsShowcase.tsx:23,78-113,119-166`
- Test: `src/widgets/home/__tests__/SkillsShowcase.test.tsx`

- [ ] **Step 1: 실패 테스트 — 문구 + 색상 경계**

`SkillsShowcase.test.tsx`에 추가:

```typescript
it('tooltip describes 3 tiers and does not mention exclusion', () => {
    render(<SkillsShowcase skills={[]} />); // 기존 렌더 패턴에 맞춤
    expect(screen.queryByText(/분석에서 제외/)).not.toBeInTheDocument();
    expect(screen.getByText(/낮은 점수도 분석에 보조적으로 반영/)).toBeInTheDocument();
});

it.each([
    [0.2, 'bg-secondary-500'],
    [0.49, 'bg-secondary-500'],
    [0.5, 'bg-ui-warning'],
    [0.79, 'bg-ui-warning'],
    [0.8, 'bg-chart-bullish'],
    [1.0, 'bg-chart-bullish'],
] as const)('confidence %f → bar color %s', (weight, cls) => {
    // 단일 스킬 카드 렌더 후 bar 요소의 className에 cls 포함 검증
    // (기존 테스트의 카드 렌더 헬퍼/쿼리 방식에 맞춤)
});
```

(기존 테스트의 렌더/쿼리 방식 — props 모양, skill fixture — 을 따른다. 본 plan은 단언 대상을 명시하고 실행자는 파일 패턴에 맞춘다.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/widgets/home/__tests__/SkillsShowcase.test.tsx`
Expected: FAIL — 현재 "제외" 문구 존재, bar 2색.

- [ ] **Step 3: tooltip 문구 교체 (106-108)**

```tsx
                <div className="text-secondary-300 leading-relaxed">
                    <p>분석 기법의 신뢰도 점수예요.</p>
                    <p>50% 미만 낮음 · 50~80% 보통 · 80% 이상 높음.</p>
                    <p>낮은 점수도 분석에 보조적으로 반영돼요.</p>
                </div>
```

- [ ] **Step 4: bar 3색 로직 (23, 119-159)**

line 23 부근 인라인 상수 옆에 Medium 경계 상수를 추가한다(core 경계와 동일 값, 의존성 절단 위해 인라인 유지):

```tsx
// 등급 경계는 @y0ngha/siglens-core의 confidence helper와 동일 값(0.5/0.8).
// SkillsShowcase는 client component이고 lcp-discovery 의존성 절단을 위해 인라인.
const MEDIUM_CONFIDENCE_WEIGHT = 0.5;
```

`SkillCard`(119-)의 `isHighConfidence` 분기(121,148-151)를 3등급 클래스 선택으로 교체:

```tsx
function barColorClass(weight: number): string {
    if (weight >= HIGH_CONFIDENCE_WEIGHT) return 'bg-chart-bullish';
    if (weight >= MEDIUM_CONFIDENCE_WEIGHT) return 'bg-ui-warning';
    return 'bg-secondary-500';
}
```

line 121 `const isHighConfidence = ...`를 `const barColor = barColorClass(skill.confidenceWeight);`로 바꾸고, 146-151의 `cn('h-full w-(--confidence-w) rounded-full', isHighConfidence ? 'bg-chart-bullish' : 'bg-ui-warning')`를 `cn('h-full w-(--confidence-w) rounded-full', barColor)`로 교체. 접근성 속성(`aria-hidden`, tooltip `aria-label`/`role`)은 유지.

- [ ] **Step 5: 테스트 통과 확인**

Run: `yarn vitest run src/widgets/home/__tests__/SkillsShowcase.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/home/SkillsShowcase.tsx src/widgets/home/__tests__/SkillsShowcase.test.tsx
git commit -m "feat(home): 3-tier confidence tooltip and bar color in SkillsShowcase"
```

---

### Task 18: siglens 카탈로그 문서 정리

**Files:**
- Modify: `README.md`, `docs/product/DOMAIN.md`, `skills/CLAUDE.md` (현재 정책/카탈로그 서술)

- [ ] **Step 1: 대상 식별**

Run: `grep -rln "wyckoff\|와이코프\|0\.5.*제외\|제외돼\|MIN_CONFIDENCE" README.md docs/product/DOMAIN.md skills/CLAUDE.md docs/architecture 2>/dev/null`
Expected: 현재-동작 문서 목록. (과거 specs/plans/CHANGELOG 제외.)

- [ ] **Step 2: 수정**

- Wyckoff를 현재 카탈로그 전략으로 드는 서술 제거.
- `<0.5` 제외 정책 서술 → "confidence는 표시 등급(Low/Medium/High)이며 포함을 결정하지 않는다"로 교체.
- `indicator_guide`에 `usage_roles`가 필수임을 스킬 작성 가이드(`skills/CLAUDE.md`)에 추가하고, 허용 enum·canonical order·`confidence weight 0.x`가 확률이 아닌 분석 비중임을 명시(스펙 §7.2).

- [ ] **Step 3: Commit**

```bash
git add README.md docs/product/DOMAIN.md skills/CLAUDE.md docs/architecture
git commit -m "docs: align skill catalog/policy docs with confidence policy and Wyckoff removal"
```

---

### Task 19: Phase 2 게이트 — overlay 기준 전체 검증

**Files:** 없음

- [ ] **Step 1: validate + test + typecheck + build**

```bash
cd /Users/y0ngha/Project/siglens
yarn validate:skills
yarn test
yarn build
```
Expected: 전부 통과 (overlay된 core 0.20.x-dev 타입 기준).

- [ ] **Step 2: 잔존 참조 확인**

Run: `grep -rni "wyckoff\|와이코프" src skills README.md docs/product skills/CLAUDE.md 2>/dev/null; for f in skills/indicators/*.md; do grep -q "usage_roles:" "$f" || echo "MISSING $f"; done`
Expected: 빈 출력.

> overlay는 커밋하지 않았는지 확인: `git status`에 `node_modules/` 변경이 없어야 한다.

---

# Phase 3 — 정식 배포 + clean install 검증

### Task 20: core 정식 배포 (사용자) + siglens 버전 갱신

**Files:**
- Modify: `package.json` (siglens, core 버전)

- [ ] **Step 1: core PR 머지 + publish (사용자)**

> **사용자가 직접 수행** (메모리: core publish는 사용자 담당). core `feat/skill-confidence-policy` PR을 리뷰·머지하고 새 버전(예: `0.21.0`)을 npm publish한다. Claude는 publish 명령을 실행하지 않는다.

- [ ] **Step 2: overlay 제거 + 정식 버전 설치**

새 core 버전이 publish된 뒤:

```bash
cd /Users/y0ngha/Project/siglens
# package.json의 "@y0ngha/siglens-core"를 새 버전으로 변경 (예: 0.21.0)
rm -rf node_modules/@y0ngha/siglens-core
yarn install
```

- [ ] **Step 3: 정식 타입 확인**

Run: `grep -n "SkillUsageRole" node_modules/@y0ngha/siglens-core/dist/index.d.ts; grep -c "MIN_CONFIDENCE_WEIGHT" node_modules/@y0ngha/siglens-core/dist/index.d.ts`
Expected: `SkillUsageRole` 존재, `MIN_CONFIDENCE_WEIGHT` count 0.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore(deps): bump @y0ngha/siglens-core to <new-version>"
```

---

### Task 21: 최종 clean install 검증

**Files:** 없음

- [ ] **Step 1: clean install 전체 검증**

```bash
cd /Users/y0ngha/Project/siglens
yarn validate:skills && yarn test && yarn lint && yarn build
```
Expected: overlay 없이(정식 패키지 기준) 전부 통과.

- [ ] **Step 2: 수용 기준 최종 확인 (스펙 §12.3)**

- [ ] 모든 `<0.5` 런타임 하한 필터 제거됨 (core grep 0).
- [ ] Low/Medium/High가 차트·fundamental·news 프롬프트 + home UI에 표시됨.
- [ ] 37개 indicator guide에 승인된 role 적용됨.
- [ ] Wyckoff가 현재 카탈로그·UI·문서에서 제거됨.
- [ ] 정식 core 패키지 설치 후 overlay 없이 siglens build 통과.
- [ ] 현재 정책 문서가 실제 동작과 일치.

- [ ] **Step 3: PR 생성 (git-agent)**

> CLAUDE.md 라우팅: 구현 완료 → review-agent → mistake-managing-agent → git-agent. 본 plan은 구현 단계 산출물이므로, 실제 실행 시 각 Phase 종료마다 review-agent를 거치고 최종적으로 git-agent가 PR을 생성한다.

---

## Self-Review (작성자 체크)

**Spec coverage:**
- §4.1 confidence 의미 → Task 10/18 문서 + helper 주석 ✓
- §4.2 표시 등급(0.5/0.8) → Task 3 helper, Task 17 UI ✓
- §4.3 포함 정책(하한 제거) → Task 4(pattern)/5(fund·news)/6(chart 라벨만) ✓
- §5 usage_roles 데이터 모델 → Task 2(타입)/8(core loader)/15(siglens parser)/16(validator) ✓
- §6 초기값 37개 → Task 13 (표 그대로) ✓
- §7.1 공통 helper/라벨 → Task 3/5/6 ✓
- §7.2 measured-reliability 유지 → 변경 안 함(Task 6는 라벨만 교체, 본문 보존) ✓
- §7.3 home UI → Task 17 ✓
- §8.1 core 하한 필터·상수 제거 → Task 4/5/7 ✓
- §8.2 결과 후처리(confidence 부착 유지, 손실 금지) → Task 4(부착 코드 보존, 필터만 제거) ✓
- §9 Wyckoff 제거 → Task 9(fixture)/14(파일·UI)/10·18(문서) ✓
- §10 저장소 경계 → Phase 1(core)/Phase 2(siglens) ✓
- §11 overlay 절차 → Task 12/19/20 ✓
- §12 테스트 → 각 Task TDD step ✓

**Placeholder scan:** 반복 카탈로그(37 md)·기존 테스트 fixture는 "기존 패턴을 따른다"로 위임했으나, 값/단언 대상/기대 결과는 모두 명시. 핵심 로직 변경은 완전 코드 포함.

**Type consistency:** `SkillUsageRole` union, `getConfidenceLevel`/`confidenceLabel`/`roleLabel`, `parseUsageRoles`(core·siglens 동일 시그니처), `USAGE_ROLE_ORDER` canonical order가 Task 2/3/8/15/16 전반에서 일치.

**주의(실행자에게):**
- core `MEDIUM_CONFIDENCE_WEIGHT`(0.7)는 등급 경계(0.5)와 다른 값이며 테스트 전용이었다. Task 7에서 제거하고 `confidence.test.ts`의 참조를 리터럴로 교체한다(Task 4 Step 4).
- 등급 경계 0.5는 제거되는 `MIN_CONFIDENCE_WEIGHT`와 같은 숫자지만 의미가 다르다 — helper의 `MEDIUM_CONFIDENCE_THRESHOLD`가 새 단일 소유자다.
- core/siglens 두 parser와 validator는 동일 규칙의 3중 미러다. 하나를 바꾸면 셋 다 맞춰야 한다.
