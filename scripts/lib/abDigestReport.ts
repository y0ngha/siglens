/**
 * 다이제스트 추론 on/off A/B 비교 리포트 — 순수 함수만 둔다(테스트 대상).
 *
 * 실행·LLM 호출은 `scripts/abDigestReasoning.ts`가 맡고, 이 모듈은 결과를 받아
 * **눈가림(blind) 리포트**와 정답 키를 만든다. 평가자가 어느 쪽이 추론 ON인지 모른
 * 채로 A/B를 고르게 해야 "추론을 켰으니 더 좋겠지"라는 기대가 판정에 섞이지 않는다.
 */

/** 한 번의 생성 결과에서 비교에 쓰는 값. */
export interface DigestVariantRun {
    readonly reasoning: boolean;
    readonly latencyMs: number;
    /** core `[Usage]` 텔레메트리 합계. 캡처 못 했으면 null. */
    readonly usage: {
        readonly promptTokens: number;
        readonly cachedTokens: number;
        readonly outputTokens: number;
    } | null;
    readonly status: string;
    readonly currentDriverKo: string;
    readonly keyEventsKo: readonly string[];
    readonly upcomingEventsKo: readonly string[];
    readonly overallSentiment: string;
}

export interface CategoryComparison {
    readonly category: string;
    readonly label: string;
    readonly newsCount: number;
    readonly on: DigestVariantRun;
    readonly off: DigestVariantRun;
}

/** 리포트에 찍을 정량 지표. 출력 토큰에는 추론 토큰이 포함된다(DeepSeek 과금 기준). */
export interface VariantMetrics {
    readonly latencyMs: number;
    readonly outputTokens: number | null;
    readonly inputTokens: number | null;
    readonly driverChars: number;
    readonly keyEvents: number;
    readonly upcomingEvents: number;
    readonly sentiment: string;
}

export function metricsOf(run: DigestVariantRun): VariantMetrics {
    return {
        latencyMs: run.latencyMs,
        outputTokens: run.usage?.outputTokens ?? null,
        inputTokens:
            run.usage === null
                ? null
                : run.usage.promptTokens + run.usage.cachedTokens,
        driverChars: [...run.currentDriverKo].length,
        keyEvents: run.keyEventsKo.length,
        upcomingEvents: run.upcomingEventsKo.length,
        sentiment: run.overallSentiment,
    };
}

/** 눈가림 배정 — 카테고리마다 A가 ON인지 OFF인지. */
export interface BlindAssignment {
    readonly category: string;
    readonly aIsReasoningOn: boolean;
}

/**
 * 카테고리마다 A/B를 무작위로 배정한다. `random`은 [0, 1)을 돌려주는 함수 —
 * 테스트가 결정적으로 고정할 수 있게 주입받는다.
 */
export function assignBlind(
    categories: readonly string[],
    random: () => number
): BlindAssignment[] {
    return categories.map(category => ({
        category,
        aIsReasoningOn: random() < 0.5,
    }));
}

function renderDigest(run: DigestVariantRun): string {
    const lines = [
        `- 상태: \`${run.status}\` · 감정: \`${run.overallSentiment}\``,
        '',
        run.currentDriverKo || '_(빈 서술)_',
        '',
        '**핵심 흐름**',
        ...run.keyEventsKo.map(e => `- ${e}`),
        '',
        '**주목 일정**',
        ...(run.upcomingEventsKo.length > 0
            ? run.upcomingEventsKo.map(e => `- ${e}`)
            : ['- (없음)']),
    ];
    return lines.join('\n');
}

/**
 * 평가자용 눈가림 리포트. 정량 지표(지연·토큰)도 **넣지 않는다** — 출력 토큰이 크면
 * 추론 ON이라는 게 바로 드러나 눈가림이 깨진다. 지표는 정답 키 쪽에만 둔다.
 */
export function renderBlindReport(
    comparisons: readonly CategoryComparison[],
    assignments: readonly BlindAssignment[],
    generatedAt: Date
): string {
    const byCategory = new Map(assignments.map(a => [a.category, a]));
    const sections = comparisons.map(c => {
        const a = byCategory.get(c.category);
        if (a === undefined) {
            throw new Error(`no blind assignment for ${c.category}`);
        }
        const [first, second] = a.aIsReasoningOn
            ? [c.on, c.off]
            : [c.off, c.on];
        return [
            `## ${c.label} (\`${c.category}\`, 입력 기사 ${c.newsCount}건)`,
            '',
            '### A',
            renderDigest(first),
            '',
            '### B',
            renderDigest(second),
            '',
            '판정: [ ] A가 낫다  [ ] B가 낫다  [ ] 차이 없음',
            '메모:',
            '',
        ].join('\n');
    });
    return [
        '# 다이제스트 A/B 눈가림 평가',
        '',
        `생성: ${generatedAt.toISOString()}`,
        '',
        '같은 기사 입력으로 설정만 바꿔 두 번 생성한 결과입니다. 어느 쪽이 어떤 설정인지는',
        '정답 키 파일에만 있습니다 — 판정을 끝낸 뒤 여세요.',
        '',
        '평가 기준(예): 사실 정확성(기사에 없는 내용·수치 오류), 흐름 파악(무엇이 시장을',
        '움직였는지), 중복·장황함, 매매 권유 문구 여부.',
        '',
        ...sections,
    ].join('\n');
}

function fmt(n: number | null): string {
    return n === null ? 'n/a' : n.toLocaleString('en-US');
}

/**
 * 정답 키 + 정량 비교. 판정을 끝낸 뒤 보는 파일이다.
 *
 * `pricePerMillion`을 주면 출력·입력 토큰으로 호출당 비용을 계산한다. 단가는 이
 * 저장소에 하드코딩하지 않는다 — 프로바이더 가격이 바뀌면 조용히 틀리기 때문이다.
 */
export function renderAnswerKey(
    comparisons: readonly CategoryComparison[],
    assignments: readonly BlindAssignment[],
    pricePerMillion?: { readonly input: number; readonly output: number }
): string {
    const byCategory = new Map(assignments.map(a => [a.category, a]));
    const cost = (m: VariantMetrics): string => {
        if (
            pricePerMillion === undefined ||
            m.inputTokens === null ||
            m.outputTokens === null
        ) {
            return 'n/a';
        }
        const usd =
            (m.inputTokens * pricePerMillion.input +
                m.outputTokens * pricePerMillion.output) /
            1_000_000;
        return `$${usd.toFixed(5)}`;
    };
    const rows = comparisons.flatMap(c => {
        const a = byCategory.get(c.category);
        const on = metricsOf(c.on);
        const off = metricsOf(c.off);
        return [
            `| ${c.category} | ${a?.aIsReasoningOn ? 'A' : 'B'} | ON | ${fmt(on.latencyMs)} | ${fmt(on.inputTokens)} | ${fmt(on.outputTokens)} | ${cost(on)} | ${on.driverChars} | ${on.keyEvents} | ${on.upcomingEvents} | ${on.sentiment} |`,
            `| ${c.category} | ${a?.aIsReasoningOn ? 'B' : 'A'} | OFF | ${fmt(off.latencyMs)} | ${fmt(off.inputTokens)} | ${fmt(off.outputTokens)} | ${cost(off)} | ${off.driverChars} | ${off.keyEvents} | ${off.upcomingEvents} | ${off.sentiment} |`,
        ];
    });
    return [
        '# 다이제스트 A/B 정답 키 + 정량 비교',
        '',
        '| 카테고리 | 라벨 | 추론 | 지연(ms) | 입력 토큰 | 출력 토큰 | 비용 | 서술 글자 | 핵심 흐름 | 주목 일정 | 감정 |',
        '|---|---|---|---|---|---|---|---|---|---|---|',
        ...rows,
        '',
        '출력 토큰에는 추론(thinking) 토큰이 포함된다. 감정이 두 변형에서 다르면 그 카테고리는',
        '특히 꼼꼼히 비교할 것 — 추론 여부가 결론 자체를 바꾼 경우다.',
    ].join('\n');
}
