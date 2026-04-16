import type {
    AnalysisResponse,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    EntryRecommendation,
    RiskLevel,
    Trend,
} from '@/domain/types';

interface BuildExpertAnalysisReportInput {
    symbol: string;
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
}

const TREND_LABEL: Record<Trend, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '보합',
};

const TREND_INTERPRETATION: Record<Trend, string> = {
    bullish: '상방 우위',
    bearish: '하방 우위',
    neutral: '방향성 탐색',
};

const RISK_LABEL: Record<RiskLevel, string> = {
    low: '낮음',
    medium: '보통',
    high: '높음',
};

const ENTRY_STANCE: Record<EntryRecommendation, string> = {
    enter: '핵심 지지 확인 이후 분할 접근 가능성을 검토할 수 있습니다.',
    wait: '추세 재확인 전까지는 관망 관점이 더 적절합니다.',
    avoid: '공격적 대응보다 보수적 관리와 비중 점검이 우선되는 구간입니다.',
};

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function formatPrice(price: number): string {
    return price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatPriceList(prices: number[]): string {
    return prices.map(formatPrice).join(', ');
}

function formatLevelWithReason(level: ClusteredKeyLevel): string {
    const confluence = level.count > 1 ? ` · ${level.count}개 근거 수렴` : '';
    return `${formatPrice(level.price)} (${level.reason}${confluence})`;
}

function buildTitle(symbol: string): string {
    return `[${symbol.toUpperCase()}] 기술적 분석 리포트`;
}

function buildInterpretation(
    analysis: AnalysisResponse,
    supportLevels: ClusteredKeyLevel[],
    resistanceLevels: ClusteredKeyLevel[]
): string {
    const parts = [
        `현재 흐름은 ${TREND_LABEL[analysis.trend]} 흐름 중 ${TREND_INTERPRETATION[analysis.trend]}로 해석되며, 리스크는 ${RISK_LABEL[analysis.riskLevel]} 수준입니다.`,
        normalizeWhitespace(analysis.summary),
    ];

    if (resistanceLevels.length > 0) {
        parts.push(
            `상단에서는 ${formatPriceList(resistanceLevels.map(level => level.price))} 구간의 저항 확인이 중요합니다.`
        );
    }

    if (supportLevels.length > 0) {
        parts.push(
            `하단에서는 ${formatPriceList(supportLevels.map(level => level.price))} 구간의 지지 유지 여부가 핵심입니다.`
        );
    }

    return parts.join(' ');
}

function buildKeyLevelsBlock(
    analysis: AnalysisResponse,
    keyLevels: ClusteredKeyLevels
): string | null {
    const lines: string[] = [];

    if (keyLevels.resistance.length > 0) {
        lines.push(
            `- 저항: ${keyLevels.resistance
                .map(formatLevelWithReason)
                .join(', ')}`
        );
    }

    if (keyLevels.support.length > 0) {
        lines.push(
            `- 지지: ${keyLevels.support.map(formatLevelWithReason).join(', ')}`
        );
    }

    if (keyLevels.poc !== undefined) {
        lines.push(
            `- PoC: ${formatPrice(keyLevels.poc.price)} (${keyLevels.poc.reason})`
        );
    }

    const { actionRecommendation } = analysis;
    if (actionRecommendation?.entryPrices?.length) {
        lines.push(
            `- 진입 참고 구간: ${formatPriceList(actionRecommendation.entryPrices)}`
        );
    }
    if (actionRecommendation?.stopLoss !== undefined) {
        lines.push(
            `- 무효화 기준: ${formatPrice(actionRecommendation.stopLoss)}`
        );
    }
    if (actionRecommendation?.takeProfitPrices?.length) {
        lines.push(
            `- 목표 참고 구간: ${formatPriceList(
                actionRecommendation.takeProfitPrices
            )}`
        );
    }

    if (lines.length === 0) return null;
    return ['주요 가격 구간:', ...lines].join('\n');
}

function buildEvidenceBlock(analysis: AnalysisResponse): string | null {
    const lines: string[] = [];

    const indicatorLines = analysis.indicatorResults
        .flatMap(result =>
            result.signals.map(signal => ({
                title: result.indicatorName,
                body: signal.description,
            }))
        )
        .filter(item => item.title !== '')
        .map(
            item =>
                `- ${item.title}\n  - ${normalizeWhitespace(item.body).replace(/\*/g, '')}`
        );
    lines.push(...indicatorLines);

    const patternLines = analysis.patternSummaries
        .filter(pattern => pattern.detected)
        .map(
            pattern =>
                `- ${pattern.skillName}\n  - ${normalizeWhitespace(
                    pattern.summary
                ).replace(/\*/g, '')}`
        );
    lines.push(...patternLines);

    const strategyLines = analysis.strategyResults.map(
        strategy =>
            `- ${strategy.strategyName}\n  - ${normalizeWhitespace(
                strategy.summary
            ).replace(/\*/g, '')}}`
    );
    lines.push(...strategyLines);

    if (lines.length === 0) return null;
    return ['기술적 근거:', ...lines].join('\n');
}

function buildScenarioBlock(analysis: AnalysisResponse): string | null {
    const lines: string[] = [];

    if (analysis.priceTargets.bullish && analysis.priceTargets.bullish.targets.length > 0) {
        lines.push(
            `- 상방: ${normalizeWhitespace(
                analysis.priceTargets.bullish.condition
            )} → ${formatPriceList(
                analysis.priceTargets.bullish.targets.map(
                    target => target.price
                )
            )}`
        );
    }

    if (analysis.priceTargets.bearish && analysis.priceTargets.bearish.targets.length > 0) {
        lines.push(
            `- 하방: ${normalizeWhitespace(
                analysis.priceTargets.bearish.condition
            )} → ${formatPriceList(
                analysis.priceTargets.bearish.targets.map(
                    target => target.price
                )
            )}`
        );
    }

    if (lines.length === 0) return null;
    return ['시나리오:', ...lines].join('\n');
}

function buildResponseStance(
    analysis: AnalysisResponse,
    keyLevels: ClusteredKeyLevels
): string {
    const { actionRecommendation } = analysis;

    if (actionRecommendation?.entryRecommendation !== undefined) {
        const base = ENTRY_STANCE[actionRecommendation.entryRecommendation];
        const entryAnchor =
            actionRecommendation.entryPrices?.length !== 0 &&
            actionRecommendation.entryPrices !== undefined
                ? `관심 구간은 ${formatPriceList(
                      actionRecommendation.entryPrices
                  )}입니다.`
                : '';
        const invalidation =
            actionRecommendation.stopLoss !== undefined
                ? `핵심 무효화 기준은 ${formatPrice(
                      actionRecommendation.stopLoss
                  )}입니다.`
                : '';

        return normalizeWhitespace([base, entryAnchor, invalidation].join(' '));
    }

    if (analysis.trend === 'bullish' && keyLevels.support.length > 0) {
        return `대응 관점에서는 ${formatPrice(
            keyLevels.support[0].price
        )} 지지 확인 이후의 분할 접근 여부를 검토할 수 있습니다.`;
    }

    if (analysis.trend === 'bearish' && keyLevels.resistance.length > 0) {
        return `대응 관점에서는 ${formatPrice(
            keyLevels.resistance[0].price
        )} 저항 확인 전까지 보수적 관리가 더 적절합니다.`;
    }

    return '대응 관점에서는 방향성 재확인 전까지 확인 중심 접근이 적절합니다.';
}

function buildRiskNote(analysis: AnalysisResponse): string {
    const { riskLevel, actionRecommendation } = analysis;
    const prefix =
        riskLevel === 'high'
            ? '변동성 확대 가능성을 우선 염두에 둘 필요가 있습니다.'
            : riskLevel === 'medium'
              ? '핵심 가격대 이탈 여부에 따라 해석이 빠르게 달라질 수 있습니다.'
              : '현재 해석이 유지되려면 핵심 지지와 저항 구간 확인이 필요합니다.';

    const suffix =
        actionRecommendation?.riskReward !== undefined
            ? normalizeWhitespace(actionRecommendation.riskReward)
            : '';

    return normalizeWhitespace([prefix, suffix].join(' '));
}

export function buildExpertAnalysisReport({
    symbol,
    analysis,
    keyLevels,
}: BuildExpertAnalysisReportInput): string {
    const supportLevels = keyLevels.support.sort((a, b) => {
        return a.price - b.price;
    });
    const resistanceLevels = keyLevels.resistance.sort((a, b) => {
        return b.price - a.price;
    });

    const sections = [
        buildTitle(symbol),
        buildInterpretation(analysis, supportLevels, resistanceLevels),
        buildKeyLevelsBlock(analysis, keyLevels),
        buildEvidenceBlock(analysis),
        buildScenarioBlock(analysis),
        `대응 관점:\n${buildResponseStance(analysis, keyLevels)}`,
        `리스크:\n${buildRiskNote(analysis)}`,
        '' + `[출처] 기술적 주가 분석 > siglens.io/${symbol}`,
    ].filter(
        (section): section is string => section !== null && section !== ''
    );

    return sections.join('\n\n');
}
