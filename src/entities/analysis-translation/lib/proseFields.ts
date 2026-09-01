/**
 * core 분석 응답에서 **산문 필드만** 골라내고 되돌려 넣는 순수 유틸.
 *
 * ## 왜 필드 목록을 손으로 적지 않는가
 *
 * core의 응답 타입은 산문 필드를 **`*Ko` 접미사**로 일관되게 표시한다
 * (`headlineKo`, `integratedConclusionKo`, `riskFactorsKo` … 21종). 이 규약을
 * 쓰면 core가 새 산문 필드를 추가해도 목록을 갱신할 필요가 없다 — 손 목록은
 * 반드시 뒤처지고, 뒤처지면 그 필드만 조용히 한국어로 남는다.
 *
 * ## 왜 산문만 건드리는가
 *
 * 숫자 필드·enum(`sentiment`, `riskLevel`, `direction`)·티커·`keyLevels`는
 * 넘기지 않는다. `*Ko` 접미사가 붙은 문자열만 후보이므로, 구조적으로 걸러진다.
 *
 * ⚠️ **다만 "숫자가 전혀 안 넘어간다"는 뜻은 아니다.** core의
 * `OverallScenario.priceRangeKo`는 `'190~200달러'`처럼 **가격이 든 문자열**이고
 * `*Ko`라서 후보에 포함된다(`__tests__/translateAnalysis.test.ts`가 그 동작을
 * 고정하고 있다). `keyEventsKo`·`upcomingEventsKo`도 날짜를 담는다. 그 값들의
 * 숫자 보존은 구조가 아니라 **프롬프트 규칙**(`api.ts`의 "Never change numbers,
 * prices, percentages, ticker symbols or dates")이 맡는다.
 */

/** 번역 대상 문자열 하나의 위치. `path`는 `a.b.0.c` 형태의 점 경로. */
export interface ProseEntry {
    readonly path: string;
    readonly text: string;
}

const KO_SUFFIX = 'Ko';

/**
 * `*Ko` 접미사를 쓰지 **않는** 한국어 산문 필드.
 *
 * ## 왜 접미사만으로는 안 되는가
 *
 * core의 21개 `*Ko` 필드는 overall·fundamental·financials·news·congress
 * 계열에만 있다. `technical`(종목 메인 페이지)·`options`·`briefing`(/market)·
 * `macroBriefing`(/economy)은 **접미사 없이** `summary`·`description` 같은
 * 이름을 쓰면서 core JSDoc에 "Korean"이라고 명시돼 있다. 접미사 휴리스틱만
 * 쓰면 그 네 화면에서 `extractProse`가 빈 배열을 돌려주고,
 * `translateAnalysis`가 즉시 원본을 반환해 **번역이 통째로 no-op**이 된다.
 * 실측: 9개 분석 화면 중 4개 — 가장 트래픽이 많은 종목 메인 포함 — 이
 * 스트림을 새로 돌려도 한국어 산문을 그대로 내보내고 있었다.
 *
 * 설계 문서(§"lib/proseFields.ts")가 처음부터 **응답 타입별 화이트리스트**를
 * 지정했는데 구현이 접미사로 갈음하면서 조용히 넷을 삼켰다.
 *
 * ⚠️ 이름 기반이라 **동명의 비-산문 필드가 생기면 오탐**이다. 지금은 없다
 * (`id`·`strategyName`·`patternName`·`expirationDate`는 목록 밖).
 * core 응답 타입이 바뀌면 `__tests__/proseFields.test.ts`의 타입별 픽스처가
 * 먼저 깨진다.
 */
const PROSE_FIELD_NAMES: ReadonlySet<string> = new Set([
    // technical — 키 레벨·시나리오 근거. core JSDoc이 "Korean rationale/
    // trigger condition"으로 명시한다. `reconciledLevels.exit`/`riskReward`는
    // 이미 번역되는데 같은 `<section>`의 `reason`만 한국어로 남아, 한 블록 안에
    // 두 언어가 섞이는 상태였다(`translateAnalysis`의 all-or-nothing 계약 위반).
    'reason', // KeyLevel.reason, ReconciledActionLevels.reason
    'basis', // PriceTarget.basis
    'condition', // PriceScenario.condition
    /**
     * `KeyPrice.label`·`SkillChartDisplay.label`·옵션 만기 라벨.
     *
     * core 프롬프트가 **한국어를 강제**한다: "All label values in keyPrices must be
     * written in Korean (e.g. \"상단 추세선\", \"넥라인\", \"목표가\")".
     * 같은 아코디언에서 `pattern.summary`는 번역되는데 그 아래 키 가격 라벨만
     * 한국어로 남아, `reconciledLevels.reason`에서 고친 것과 똑같이 한 블록에
     * 두 언어가 섞였다.
     *
     * 오탐 확인: `SectorGroupDef.label`(영어 `"Technology"`)과
     * `MarketBriefingContext`의 `label`은 **입력·설정 타입**이라 어떤 디스패치
     * 응답에도 실리지 않는다.
     */
    'label',
    // technical (`AnalysisResponse`)
    'summary', // 최상위 + StrategyResult + CandlePatternSummary 공용
    'description', // AnalysisSignal + MarketBriefingVolatilityAnalysis
    'positionAnalysis',
    'entry',
    'exit',
    'riskReward',
    // options (`OptionsAnalysisResponse`)
    'commentary',
    'message',
    // briefing (`MarketBriefingResponse`)
    'dominantThemes',
    'performanceDescription',
    'riskSentiment',
    // macroBriefing (`MacroBriefingResponse`)
    'highlights',
]);

/** 이 키가 산문 필드인가. */
function isProseKey(key: string): boolean {
    if (key.endsWith(KO_SUFFIX) && key !== KO_SUFFIX) return true;
    return PROSE_FIELD_NAMES.has(key);
}

/**
 * 응답 객체에서 번역 대상 문자열을 전부 뽑는다(배열·중첩 객체 포함).
 *
 * 빈 문자열과 공백만 있는 값은 건너뛴다 — 번역 호출만 늘고 결과가 같다.
 */
export function extractProse(value: unknown, prefix = ''): ProseEntry[] {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) =>
            extractProse(item, `${prefix}${prefix ? '.' : ''}${index}`)
        );
    }
    if (typeof value !== 'object' || value === null) return [];

    return Object.entries(value).flatMap(([key, child]) => {
        const path = `${prefix}${prefix ? '.' : ''}${key}`;
        // 산문 키가 아니면 그 아래를 다시 훑는다.
        if (!isProseKey(key)) return extractProse(child, path);

        if (typeof child === 'string') {
            return child.trim() ? [{ path, text: child }] : [];
        }
        if (Array.isArray(child)) {
            return child.flatMap((item, index) =>
                typeof item === 'string' && item.trim()
                    ? [{ path: `${path}.${index}`, text: item }]
                    : []
            );
        }
        // 산문 키인데 문자열도 배열도 아니면 번역 대상이 없다. 여기서 다시
        // 내려가지 않는 것이 의도다 — `summary: { ko: ... }` 같은 형태를
        // 재귀로 훑으면 `summary.ko`가 산문 키가 아니라 통째로 누락된다.
        return [];
    });
}
