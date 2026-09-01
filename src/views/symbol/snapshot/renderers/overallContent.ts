import type { OverallScenarioName } from '@y0ngha/siglens-core';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';

// Guard-only key map — the scenario section headings below are hardcoded
// Korean strings ("강세 시나리오" / ...), not derived from this map, but its
// keys must cover exactly `OverallScenarioName`'s members (PR #698 round-2
// review FIX 3: converted from an `Array.includes` membership check to the
// shared `createEnumGuard` factory — semantics are equivalent, both reject
// any string outside {bullish, neutral, bearish}). See createEnumGuard's
// JSDoc for the Object.hasOwn / prototype-chain rationale. Values are
// `shared.enumLabel` catalog keys (`overallScenario.*`), not Korean text —
// unused for rendering today, kept in sync in case a future call site needs
// the display label.
const SCENARIO_NAME_LABEL_KEY: Record<OverallScenarioName, string> = {
    bullish: 'overallScenario.bullish',
    neutral: 'overallScenario.neutral',
    bearish: 'overallScenario.bearish',
};

const isScenarioName = createEnumGuard(SCENARIO_NAME_LABEL_KEY);

interface NarrowedScenario {
    name: OverallScenarioName;
    triggerConditionKo: string;
    priceRangeKo: string;
}

function narrowScenario(value: unknown): NarrowedScenario | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (!isScenarioName(record.name)) return null;

    const triggerConditionKo =
        typeof record.triggerConditionKo === 'string'
            ? stripSnapshotMarkdown(record.triggerConditionKo)
            : '';
    const priceRangeKo =
        typeof record.priceRangeKo === 'string'
            ? stripSnapshotMarkdown(record.priceRangeKo)
            : '';

    return { name: record.name, triggerConditionKo, priceRangeKo };
}

/**
 * 시나리오 하나를 bullet 텍스트로 합성한다. trigger/priceRange가 둘 다
 * 비어있으면(정규화 실패·LLM 누락) `null`을 돌려줘 호출부가 그 항목을
 * 건너뛰게 한다.
 */
/**
 * 불릿 조립에 쓸 **조각**을 돌려준다. 문장을 여기서 만들지 않는 이유는 두
 * 가지다: (1) `narrowOverallContent`는 `hasOverallProse`(순수 술어)도 쓰는
 * 경로라 번역자를 받을 수 없고, (2) `예상 가격대: X`의 어순이 로케일마다
 * 달라 접미사만 갈아끼우는 방식으로는 영어 문장이 어색해진다. 조립은
 * 번역자를 선언한 렌더 컴포넌트가 한다.
 */
export interface ScenarioBullet {
    trigger: string;
    priceRange: string;
}

function formatScenarioBullet(
    scenario: NarrowedScenario
): ScenarioBullet | null {
    const trigger = scenario.triggerConditionKo.trim();
    const priceRange = scenario.priceRangeKo.trim();

    if (trigger.length === 0 && priceRange.length === 0) return null;
    return { trigger, priceRange };
}

interface NarrowedOverallContent {
    headlineKo: string;
    integratedConclusionKo: string;
    bullishBullets: ScenarioBullet[];
    neutralBullets: ScenarioBullet[];
    bearishBullets: ScenarioBullet[];
    riskFactorsKo: string[];
    technicalBulletsKo: string[];
    fundamentalBulletsKo: string[];
    newsBulletsKo: string[];
    optionsBulletsKo: string[];
    financialsBulletsKo: string[];
}

/**
 * `content`를 overall 결과 모양으로 좁힌다.
 *
 * core `OverallAnalysisResponse`(`node_modules/@y0ngha/siglens-core/dist/domain/types.d.ts`)는
 * `bullishBulletsKo`/`bearishBulletsKo` 같은 전용 배열 필드가 없다 — 대신
 * `scenarios: OverallScenario[]`(각 `{ name: 'bullish'|'neutral'|'bearish',
 * triggerConditionKo, priceRangeKo }`)로 강세/중립/약세 세 시나리오를 표현한다.
 * 이 렌더러는 세 시나리오 전부를 trigger+priceRange를 합성한 bullet 문자열로
 * 변환한다(audit fix — 이전에는 `neutral`을 드롭했다. 대체 대상인
 * `OverallFactsSummary`가 세 시나리오 전부를 렌더하므로, neutral을 빼면
 * 대체 전보다 텍스트가 줄어드는 회귀였다). `riskFactorsKo`도
 * `OverallFactsSummary`와 동일하게 위험 요인 목록으로 노출한다.
 *
 * `technicalBulletsKo`/`fundamentalBulletsKo`/`newsBulletsKo`/
 * `optionsBulletsKo`/`financialsBulletsKo`도 좁힌다(audit fix FIX 2) — core
 * `OverallAnalysisResponse`는 이 다섯 필드를 REQUIRED 배열로 선언하고
 * (`responseSchemas.js`), overall도 다른 필드들과 동일하게 tier 마스킹
 * 대상이 아니므로(위 JSDoc) free tier pre-warm에도 전부 채워진다. 이전
 * 렌더러는 이 다섯 배열을 전혀 읽지 않아 심볼당 400~900자 규모의 크롤
 * 가능 텍스트가 저장은 되고도 버려지고 있었다.
 */
export function narrowOverallContent(
    content: unknown
): NarrowedOverallContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const headlineKo =
        typeof record.headlineKo === 'string'
            ? stripSnapshotMarkdown(record.headlineKo).trim()
            : '';
    const integratedConclusionKo =
        typeof record.integratedConclusionKo === 'string'
            ? stripSnapshotMarkdown(record.integratedConclusionKo).trim()
            : '';

    const scenarios = Array.isArray(record.scenarios)
        ? record.scenarios.flatMap(raw => {
              const scenario = narrowScenario(raw);
              return scenario === null ? [] : [scenario];
          })
        : [];

    // 이름별 불릿 추출 — 시나리오 배열을 이름당 한 번씩만 순회한다.
    const bulletsOf = (name: string): ScenarioBullet[] =>
        scenarios.flatMap(scenario => {
            if (scenario.name !== name) return [];
            const bullet = formatScenarioBullet(scenario);
            return bullet === null ? [] : [bullet];
        });

    const bullishBullets = bulletsOf('bullish');
    const neutralBullets = bulletsOf('neutral');
    const bearishBullets = bulletsOf('bearish');

    const riskFactorsKo = narrowStringArray(record.riskFactorsKo);
    const technicalBulletsKo = narrowStringArray(record.technicalBulletsKo);
    const fundamentalBulletsKo = narrowStringArray(record.fundamentalBulletsKo);
    const newsBulletsKo = narrowStringArray(record.newsBulletsKo);
    const optionsBulletsKo = narrowStringArray(record.optionsBulletsKo);
    const financialsBulletsKo = narrowStringArray(record.financialsBulletsKo);

    if (
        headlineKo.length === 0 &&
        integratedConclusionKo.length === 0 &&
        bullishBullets.length === 0 &&
        neutralBullets.length === 0 &&
        bearishBullets.length === 0 &&
        riskFactorsKo.length === 0 &&
        technicalBulletsKo.length === 0 &&
        fundamentalBulletsKo.length === 0 &&
        newsBulletsKo.length === 0 &&
        optionsBulletsKo.length === 0 &&
        financialsBulletsKo.length === 0
    ) {
        return null;
    }

    return {
        headlineKo,
        integratedConclusionKo,
        technicalBulletsKo,
        fundamentalBulletsKo,
        newsBulletsKo,
        optionsBulletsKo,
        financialsBulletsKo,
        bullishBullets,
        neutralBullets,
        bearishBullets,
        riskFactorsKo,
    };
}

/**
 * `overall/page.tsx`가 `<OverallSnapshotProse>`를 렌더할지(스냅샷 프로즈)
 * 아니면 기존 peek/placeholder 체인(`OverallFactsSummary`/
 * `OverallFactualFallback`)으로 폴백할지 판단하는 예측기(audit fix FIX 1b).
 *
 * 페이지는 이전에 "행 존재 여부"(`overallSnapshot !== undefined`)로
 * 분기했다 — 그러나 행은 있지만 `content`가 `narrowOverallContent`를
 * 통과하지 못하면(malformed JSONB) `OverallSnapshotProse`가 `null`을
 * 반환하는데, 페이지는 이미 peek 분기를 건너뛴 상태라 섹션 전체가
 * 아무것도 렌더하지 않는 회귀가 생긴다 — 오늘의 baseline(스냅샷 없을 때
 * peek/placeholder를 보여주던 것)보다 더 나쁜 결과다.
 *
 * `narrowOverallContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로
 * 다른 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasOverallProse(content: unknown): boolean {
    return narrowOverallContent(content) !== null;
}
