import type {
    AnalysisResponse,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    EntryRecommendation,
    RiskLevel,
    Trend,
} from '@y0ngha/siglens-core';
import {
    resolveEffectiveActionLevels,
    type EffectiveActionLevels,
} from '@/entities/analysis';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

interface BuildExpertAnalysisReportInput {
    symbol: string;
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
    /**
     * `shared.enumLabel`에 바인딩된 번역자 — 필수 인자다. 기본값을 두면 호출부가
     * 조용히 누락해도 컴파일이 통과하고, 그 결과 라벨이 `trend.bullish` 같은 raw
     * 카탈로그 키 문자열로 리포트에 그대로 섞여 나간다.
     */
    t: EnumLabelTranslator;
    /** `widgets.analysis.expertReport` 번역자. */
    tReport: ReportTranslator;
}

/**
 * `widgets.analysis.expertReport` 번역자.
 *
 * 이 모듈은 순수 함수 모음이라 훅을 부를 수 없다 — 진입점이 받아 헬퍼로 넘긴다
 * (`t`(EnumLabelTranslator)가 이미 같은 방식으로 흐른다).
 */
type ReportTranslator = (
    key: string,
    values?: Record<string, string | number>
) => string;

const TREND_LABEL_KEY: Record<Trend, string> = {
    bullish: 'trend.bullish',
    bearish: 'trend.bearish',
    neutral: 'trend.neutral',
};

const TREND_INTERPRETATION_KEY: Record<Trend, string> = {
    bullish: 'trendInterpretation.bullish',
    bearish: 'trendInterpretation.bearish',
    neutral: 'trendInterpretation.neutral',
};

const RISK_LABEL_KEY: Record<RiskLevel, string> = {
    low: 'riskLevel.low',
    medium: 'riskLevel.medium',
    high: 'riskLevel.high',
};

const ENTRY_STANCE_KEY: Record<EntryRecommendation, string> = {
    enter: 'entryStance.enter',
    wait: 'entryStance.wait',
    avoid: 'entryStance.avoid',
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

function formatLevelWithReason(
    level: ClusteredKeyLevel,
    tReport: ReportTranslator
): string {
    const confluence =
        level.count > 1 ? tReport('levelConvergence', { v0: level.count }) : '';
    return `${formatPrice(level.price)} (${level.reason}${confluence})`;
}

function buildTitle(symbol: string, tReport: ReportTranslator): string {
    return tReport('reportTitle', { v0: symbol.toUpperCase() });
}

function buildInterpretation(
    analysis: AnalysisResponse,
    supportLevels: ClusteredKeyLevel[],
    resistanceLevels: ClusteredKeyLevel[],
    t: EnumLabelTranslator,
    tReport: ReportTranslator
): string {
    const parts = [
        tReport('trendSummary', {
            v0: t(TREND_LABEL_KEY[analysis.trend]),
            v1: t(TREND_INTERPRETATION_KEY[analysis.trend]),
            v2: t(RISK_LABEL_KEY[analysis.riskLevel]),
        }),
        normalizeWhitespace(analysis.summary),
    ];

    if (resistanceLevels.length > 0) {
        parts.push(
            tReport('resistanceNote', {
                v0: formatPriceList(resistanceLevels.map(level => level.price)),
            })
        );
    }

    if (supportLevels.length > 0) {
        parts.push(
            tReport('supportNote', {
                v0: formatPriceList(supportLevels.map(level => level.price)),
            })
        );
    }

    return parts.join(' ');
}

function buildKeyLevelsBlock(
    analysis: AnalysisResponse,
    keyLevels: ClusteredKeyLevels,
    effectiveLevels: EffectiveActionLevels,
    tReport: ReportTranslator
): string | null {
    const lines: string[] = [];

    if (keyLevels.resistance.length > 0) {
        lines.push(
            tReport('levelsResistance', {
                v0: keyLevels.resistance
                    .map(level => formatLevelWithReason(level, tReport))
                    .join(', '),
            })
        );
    }

    if (keyLevels.support.length > 0) {
        lines.push(
            tReport('levelsSupport', {
                v0: keyLevels.support
                    .map(level => formatLevelWithReason(level, tReport))
                    .join(', '),
            })
        );
    }

    if (keyLevels.poc !== undefined) {
        lines.push(
            `- PoC: ${formatPrice(keyLevels.poc.price)} (${keyLevels.poc.reason})`
        );
    }

    const { actionRecommendation } = analysis;
    // 손절/익절은 AI 원본이 아니라 **실효값**을 싣는다 — core가 무효로 판정한
    // 레벨을 원본 필드에 그대로 남겨두기 때문. 근거는 헬퍼 JSDoc 참고.
    const { stopLoss, takeProfitPrices } =
        resolveEffectiveActionLevels(actionRecommendation);
    if (actionRecommendation?.entryPrices?.length) {
        lines.push(
            tReport('entryZone', {
                v0: formatPriceList(actionRecommendation.entryPrices),
            })
        );
    }
    if (stopLoss !== undefined) {
        lines.push(
            tReport('invalidation', {
                v0: formatPrice(stopLoss),
            })
        );
    }
    if (takeProfitPrices?.length) {
        lines.push(
            tReport('targetZone', {
                v0: formatPriceList(takeProfitPrices),
            })
        );
    }

    if (lines.length === 0) return null;
    return [tReport('keyLevelsHeading'), ...lines].join('\n');
}

function buildEvidenceBlock(
    analysis: AnalysisResponse,
    tReport: ReportTranslator
): string | null {
    const lines: string[] = [];

    const indicatorLines = (analysis.indicatorResults ?? []).flatMap(result =>
        result.indicatorName === ''
            ? []
            : result.signals.map(
                  signal =>
                      `- ${result.indicatorName}\n  - ${normalizeWhitespace(signal.description).replace(/\*/g, '')}`
              )
    );
    lines.push(...indicatorLines);

    const patternLines = (analysis.patternSummaries ?? []).flatMap(pattern =>
        pattern.detected
            ? [
                  `- ${pattern.skillName}\n  - ${normalizeWhitespace(
                      pattern.summary
                  ).replace(/\*/g, '')}`,
              ]
            : []
    );
    lines.push(...patternLines);

    const strategyLines = (analysis.strategyResults ?? []).map(
        strategy =>
            `- ${strategy.strategyName}\n  - ${normalizeWhitespace(
                strategy.summary
            ).replace(/\*/g, '')}`
    );
    lines.push(...strategyLines);

    if (lines.length === 0) return null;
    return [tReport('evidenceHeading'), ...lines].join('\n');
}

function buildScenarioBlock(
    analysis: AnalysisResponse,
    tReport: ReportTranslator
): string | null {
    const lines: string[] = [];
    // priceTargets는 부분 응답에서 누락될 수 있으므로 방어적으로 기본값을 둔다.
    const priceTargets = analysis.priceTargets ?? {
        bullish: null,
        bearish: null,
    };

    if (priceTargets.bullish && priceTargets.bullish.targets.length > 0) {
        lines.push(
            tReport('upside', {
                v0: normalizeWhitespace(priceTargets.bullish.condition),
                v1: formatPriceList(
                    priceTargets.bullish.targets.map(target => target.price)
                ),
            })
        );
    }

    if (priceTargets.bearish && priceTargets.bearish.targets.length > 0) {
        lines.push(
            tReport('downside', {
                v0: normalizeWhitespace(priceTargets.bearish.condition),
                v1: formatPriceList(
                    priceTargets.bearish.targets.map(target => target.price)
                ),
            })
        );
    }

    if (lines.length === 0) return null;
    return [tReport('scenarioHeading'), ...lines].join('\n');
}

function buildResponseStance(
    analysis: AnalysisResponse,
    keyLevels: ClusteredKeyLevels,
    effectiveLevels: EffectiveActionLevels,
    t: EnumLabelTranslator,
    tReport: ReportTranslator
): string {
    const { actionRecommendation } = analysis;

    if (actionRecommendation?.entryRecommendation !== undefined) {
        const base = t(
            ENTRY_STANCE_KEY[actionRecommendation.entryRecommendation]
        );
        const entryAnchor =
            actionRecommendation.entryPrices?.length !== 0 &&
            actionRecommendation.entryPrices !== undefined
                ? tReport('entryAnchor', {
                      v0: formatPriceList(actionRecommendation.entryPrices),
                  })
                : '';
        const invalidation =
            effectiveLevels.stopLoss !== undefined
                ? tReport('invalidationNote', {
                      v0: formatPrice(effectiveLevels.stopLoss),
                  })
                : '';

        return normalizeWhitespace([base, entryAnchor, invalidation].join(' '));
    }

    if (analysis.trend === 'bullish' && keyLevels.support.length > 0) {
        return tReport('stanceBullish', {
            v0: formatPrice(keyLevels.support[0].price),
        });
    }

    if (analysis.trend === 'bearish' && keyLevels.resistance.length > 0) {
        return tReport('stanceBearish', {
            v0: formatPrice(keyLevels.resistance[0].price),
        });
    }

    return tReport('stanceNeutral');
}

function buildRiskNote(
    analysis: AnalysisResponse,
    tReport: ReportTranslator
): string {
    const { riskLevel, actionRecommendation } = analysis;
    const prefix =
        riskLevel === 'high'
            ? tReport('riskHigh')
            : riskLevel === 'medium'
              ? tReport('riskMedium')
              : tReport('riskLow');

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
    t,
    tReport,
}: BuildExpertAnalysisReportInput): string {
    // keyLevels(ClusteredKeyLevels)는 부분 객체로 전달될 수 있으므로 support/
    // resistance 배열을 입구에서 1회 정규화한다 — 이후 helper들이 안전한 배열을
    // 공유한다.
    const safeKeyLevels: ClusteredKeyLevels = {
        support: keyLevels.support ?? [],
        resistance: keyLevels.resistance ?? [],
        poc: keyLevels.poc,
    };

    const supportLevels = safeKeyLevels.support.toSorted((a, b) => {
        return a.price - b.price;
    });
    const resistanceLevels = safeKeyLevels.resistance.toSorted((a, b) => {
        return b.price - a.price;
    });

    // 손절/익절은 AI 원본이 아니라 **실효값**을 싣는다 — core는 무효로 판정한
    // 레벨을 원본 필드에 그대로 남겨두고 보정값을 따로 붙이기 때문(근거는 헬퍼
    // JSDoc). 입구에서 1회만 해석해 각 helper에 넘긴다 — 원본 필드를 다시 읽는
    // 소비자가 생기는 것이 이 파일에 있던 버그였다.
    const effectiveLevels = resolveEffectiveActionLevels(
        analysis.actionRecommendation
    );

    const sections = [
        buildTitle(symbol, tReport),
        buildInterpretation(
            analysis,
            supportLevels,
            resistanceLevels,
            t,
            tReport
        ),
        buildKeyLevelsBlock(analysis, safeKeyLevels, effectiveLevels, tReport),
        buildEvidenceBlock(analysis, tReport),
        buildScenarioBlock(analysis, tReport),
        `${tReport('responseStance')}
${buildResponseStance(analysis, safeKeyLevels, effectiveLevels, t, tReport)}`,
        `${tReport('riskLabel')}
${buildRiskNote(analysis, tReport)}`,
        tReport('source', { v0: symbol }),
    ].filter(
        (section): section is string => section !== null && section !== ''
    );

    return sections.join('\n\n');
}
