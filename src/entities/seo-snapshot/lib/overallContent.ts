import type { OverallScenarioName } from '@y0ngha/siglens-core';
import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';
import { createEnumGuard } from './createEnumGuard';
import { asRecord, narrowCleanString } from './narrowJson';
import { narrowStringArray } from './narrowStringArray';

// 가드 전용 키 맵이다 — 시나리오 섹션 제목은 이 맵에서 파생되지 않고 렌더러에 하드코딩돼
// 있지만, 키는 `OverallScenarioName`의 멤버와 정확히 일치해야 한다. 값은
// `shared.enumLabel` 카탈로그 키(`overallScenario.*`)이며 현재 렌더에는 쓰이지 않는다.
// `Object.hasOwn`으로 거르는 이유는 `createEnumGuard` JSDoc 참고.
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
    const record = asRecord(value);
    if (record === null) return null;
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
 * 시나리오 불릿 조립에 쓸 **조각**. 문장을 여기서 만들지 않는 이유는 두 가지다:
 * (1) `narrowOverallContent`는 `hasOverallProse`(순수 술어)도 쓰는 경로라 번역자를 받을 수
 * 없고, (2) `예상 가격대: X`의 어순이 로케일마다 달라 접미사만 갈아끼우는 방식으로는 영어
 * 문장이 어색해진다. 조립은 번역자를 선언한 렌더 컴포넌트가 한다.
 */
export interface ScenarioBullet {
    trigger: string;
    priceRange: string;
}

/**
 * 시나리오 하나를 불릿 조각으로 바꾼다. trigger/priceRange가 둘 다 비어 있으면(정규화 실패·LLM
 * 누락) `null`을 돌려줘 호출부가 그 항목을 건너뛰게 한다.
 */
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
    /** 수급 요약 — core가 점수표를 받았을 때만 채워지는 선택 필드라 없으면 빈 배열. */
    investorFlowsBulletsKo: string[];
}

/**
 * `content`를 overall 결과 모양으로 좁힌다. 산문 근거가 전혀 없으면 `null`.
 *
 * core `OverallAnalysisResponse`(`node_modules/@y0ngha/siglens-core/dist/domain/types.d.ts`)는
 * `bullishBulletsKo`/`bearishBulletsKo` 같은 전용 배열 필드가 없다 — 대신
 * `scenarios: OverallScenario[]`(각 `{ name: 'bullish'|'neutral'|'bearish', triggerConditionKo,
 * priceRangeKo }`)로 강세/중립/약세 세 시나리오를 표현한다. 세 시나리오 전부를
 * trigger+priceRange 불릿 조각으로 변환한다(`OverallFactsSummary`가 세 시나리오를 모두
 * 렌더하므로 neutral을 빼면 텍스트가 줄어든다). `riskFactorsKo`도 같은 이유로 위험 요인
 * 목록으로 노출한다.
 *
 * `technicalBulletsKo`/`fundamentalBulletsKo`/`newsBulletsKo`/`optionsBulletsKo`/
 * `financialsBulletsKo`도 좁힌다 — core `OverallAnalysisResponse`는 이 다섯 필드를 REQUIRED
 * 배열로 선언하고(`responseSchemas.js`), overall은 tier 마스킹 대상이 아니라 free tier
 * pre-warm에도 전부 채워지며, 읽지 않으면 심볼당 400~900자 규모의 크롤 가능 텍스트가 저장만
 * 되고 버려진다. `investorFlowsBulletsKo`는 core가 점수표를 받았을 때만 채워지는 선택 필드다.
 */
export function narrowOverallContent(
    content: unknown
): NarrowedOverallContent | null {
    const record = asRecord(content);
    if (record === null) return null;

    const headlineKo = narrowCleanString(record.headlineKo);
    const integratedConclusionKo = narrowCleanString(
        record.integratedConclusionKo
    );

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
    const investorFlowsBulletsKo = narrowStringArray(
        record.investorFlowsBulletsKo
    );

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
        financialsBulletsKo.length === 0 &&
        investorFlowsBulletsKo.length === 0
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
        investorFlowsBulletsKo,
        bullishBullets,
        neutralBullets,
        bearishBullets,
        riskFactorsKo,
    };
}

/**
 * `overall/page.tsx`가 `<OverallSnapshotProse>`를 렌더할지(스냅샷 산문) 아니면 peek/placeholder
 * 체인(`OverallFactsSummary`/`OverallFactualFallback`)으로 폴백할지 판단하는 예측기.
 *
 * "행 존재 여부"로 분기하면 안 된다 — 행은 있지만 `content`가 `narrowOverallContent`를
 * 통과하지 못할 때(손상된 JSONB) `OverallSnapshotProse`는 `null`을 반환하는데, 페이지는 이미
 * peek 분기를 건너뛴 상태라 섹션 전체가 아무것도 렌더하지 않는다. 렌더러와 같은
 * `narrowOverallContent`를 쓰므로 둘이 서로 다른 판단을 내릴 수 없다.
 */
export function hasOverallProse(content: unknown): boolean {
    return narrowOverallContent(content) !== null;
}
