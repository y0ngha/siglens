/** 번역 대상 문자열 하나의 위치. `path`는 `a.b.0.c` 형태의 점 경로. */
export interface ProseEntry {
    readonly path: string;
    readonly text: string;
}

/**
 * core는 산문 필드를 `*Ko` 접미사로 일관되게 표시한다(`headlineKo`,
 * `integratedConclusionKo`, `riskFactorsKo` …). 필드 목록을 손으로 적지 않고
 * 접미사를 쓰는 이유는 core가 새 산문 필드를 추가해도 목록 갱신이 필요 없기
 * 때문이다 — 손 목록은 반드시 뒤처지고, 뒤처지면 그 필드만 조용히 한국어로
 * 남는다. 숫자·enum(`sentiment`, `riskLevel`)·티커·`keyLevels`는 접미사가 없어
 * 구조적으로 걸러지므로 산문 문자열만 번역 대상으로 넘어간다.
 */
const KO_SUFFIX = 'Ko';

/**
 * `*Ko` 접미사를 쓰지 **않는** 한국어 산문 필드의 이름 화이트리스트.
 *
 * core의 `*Ko` 필드는 overall·fundamental·financials·news·congress 계열에만
 * 있다. `technical`(종목 메인)·`options`·`briefing`(/market)·`macroBriefing`
 * (/economy)은 접미사 없이 `summary`·`description` 같은 이름을 쓰며 core JSDoc이
 * "Korean"이라고 명시한다. 접미사만 보면 이 네 화면은 빈 배열이 되어 번역이
 * 통째로 no-op이 된다. 9개 분석 화면 중 이 네 화면이 접미사 없는 산문을 쓰며,
 * 트래픽이 가장 많은 종목 메인(`technical`)도 포함된다. 재확인: core 응답
 * 타입(`AnalysisResponse`·`OptionsAnalysisResponse`·`MarketBriefingResponse`·
 * `MacroBriefingResponse`)의 한국어 산문 필드 이름을 훑어 접미사 유무를 본다.
 *
 * 이름 기반이라 동명의 비-산문 필드가 생기면 오탐이다. 지금은 없다(`id`·
 * `strategyName`·`patternName`·`expirationDate`는 목록 밖). core 응답 타입이
 * 바뀌면 타입별 픽스처 테스트(`proseFields.dispatch.test.ts`)가 먼저 깨진다.
 */
const PROSE_FIELD_NAMES: ReadonlySet<string> = new Set([
    // technical — 키 레벨·시나리오 근거. core JSDoc이 "Korean rationale/
    // trigger condition"으로 명시한다. 같은 블록의 `exit`/`riskReward`만 번역되면
    // 한 블록 안에 두 언어가 섞이므로 `reason`도 대상이다.
    'reason', // KeyLevel.reason, ReconciledActionLevels.reason
    'basis', // PriceTarget.basis
    'condition', // PriceScenario.condition
    /**
     * `KeyPrice.label`·`SkillChartDisplay.label`·옵션 만기 라벨.
     *
     * core 프롬프트가 한국어를 강제한다("All label values in keyPrices must be
     * written in Korean"). 같은 아코디언의 `pattern.summary`만 번역되면 두 언어가
     * 섞인다. `SectorGroupDef.label`(영어)·`MarketBriefingContext`의 `label`은
     * 입력·설정 타입이라 어떤 디스패치 응답에도 실리지 않아 오탐이 아니다.
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

/** 이 키가 산문 필드인가 — `*Ko` 접미사(`KO_SUFFIX` 참고) 또는 접미사 없는 예외 목록. */
function isProseKey(key: string): boolean {
    if (key.endsWith(KO_SUFFIX) && key !== KO_SUFFIX) return true;
    return PROSE_FIELD_NAMES.has(key);
}

/** 점 경로에 세그먼트를 붙인다. 빈 접두사면 세그먼트만 돌려준다. */
function joinPath(prefix: string, segment: string | number): string {
    return prefix ? `${prefix}.${segment}` : `${segment}`;
}

/** 산문 키의 값(문자열 또는 문자열 배열)에서 비어 있지 않은 항목을 뽑는다. */
function proseValueEntries(path: string, value: unknown): ProseEntry[] {
    if (typeof value === 'string') {
        return value.trim() ? [{ path, text: value }] : [];
    }
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index) =>
        typeof item === 'string' && item.trim()
            ? [{ path: joinPath(path, index), text: item }]
            : []
    );
}

/**
 * 응답 객체에서 번역 대상 산문 문자열을 전부 뽑는다(배열·중첩 객체 포함).
 *
 * 소비자: `analysis-plain`의 프롬프트 조립. 숫자·enum·티커는 `*Ko`/화이트리스트
 * 밖이라 걸러지지만, `priceRangeKo`(`'190~200달러'`)처럼 가격이 든 `*Ko` 문자열은
 * 후보에 포함되고 `keyEventsKo`·`upcomingEventsKo`도 날짜를 담는다. 이 값들의
 * 숫자 보존은 이 함수가 보장하지 않으므로 추출한 문장을 쓰는 쪽이 책임진다.
 * 빈 문자열·공백만 있는 값은 번역 호출만 늘리므로 건너뛴다.
 */
export function extractProse(value: unknown, prefix = ''): ProseEntry[] {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) =>
            extractProse(item, joinPath(prefix, index))
        );
    }
    if (typeof value !== 'object' || value === null) return [];

    return Object.entries(value).flatMap(([key, child]) => {
        const path = joinPath(prefix, key);
        if (!isProseKey(key)) return extractProse(child, path);
        // 산문 키 아래로는 다시 내려가지 않는다 — `summary: { ko: ... }`를
        // 재귀로 훑으면 `summary.ko`가 산문 키가 아니라 통째로 누락된다.
        return proseValueEntries(path, child);
    });
}
