/**
 * 분석 결과 → 복사용 전문가 리포트 텍스트 빌더. 섹션(해석·핵심 레벨·근거·시나리오·
 * 대응·리스크)별 헬퍼가 문자열을 만들고 진입점이 이어 붙인다.
 */
import type {
    AnalysisResponse,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    EntryRecommendation,
    KrxTickTable,
    PriceScenario,
    RiskLevel,
    Trend,
} from '@y0ngha/siglens-core';
import {
    resolveEffectiveActionLevels,
    type EffectiveActionLevels,
} from '@/entities/analysis/lib/effectiveActionLevels';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import { quotedPriceForSymbol } from '@/shared/lib/analysisPriceFormat';
import { currencyFractionDigits } from '@/shared/lib/priceFormat';
import { currencyForSymbol } from '@/shared/config/marketProfile/registry';
import { selectPanelSkillResults } from './panelSkillResults';
import { TREND_LABEL_KEY } from './trendUtils';

interface BuildExpertAnalysisReportInput {
    symbol: string;
    /** 종목의 KRX 호가표(주식/ETF) — 패널 표기와 같아야 복사본 가격이 화면과 어긋나지 않는다. 기본 'share'. */
    krxTickTable?: KrxTickTable;
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
    /**
     * 스킬 원본 이름 → 로케일 표시명(`useSkillLabel`). 필수다 — 빠지면 `/en`
     * 복사본에 한국어 front-matter 이름이 섞인다(패널은 이미 표시명을 쓴다).
     */
    skillLabel: (name: string) => string;
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

/** RiskLevel → `widgets.analysis.expertReport` 리스크 문장 키. */
const RISK_NOTE_KEY: Record<RiskLevel, string> = {
    high: 'riskHigh',
    medium: 'riskMedium',
    low: 'riskLow',
};

const ENTRY_STANCE_KEY: Record<EntryRecommendation, string> = {
    enter: 'entryStance.enter',
    wait: 'entryStance.wait',
    avoid: 'entryStance.avoid',
};

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

/** 리포트 한 줄에 들어가는 가격 한 개의 표기. */
type ReportPriceFormatter = (price: number) => string;

// 통화 기호 없는 숫자 — shared `formatPrice(value, spec)`(통화 표기)와 다르다. 한국
// 종목은 호가 단위로 반올림한 정수, 그 밖은 소수 둘째 자리다(패널의
// `formatAnalysisPrice`와 같은 규칙). `undefined` 로케일은 기존 표기를 그대로 둔
// 것이다(런타임 기본 로케일을 따른다).
function reportPriceFormatter(
    symbol: string,
    krxTickTable: KrxTickTable
): ReportPriceFormatter {
    const digits = currencyFractionDigits(currencyForSymbol(symbol));
    return price =>
        quotedPriceForSymbol(price, symbol, krxTickTable).toLocaleString(
            undefined,
            {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
            }
        );
}

function formatPriceList(
    prices: number[],
    formatPrice: ReportPriceFormatter
): string {
    return prices.map(formatPrice).join(', ');
}

function formatLevelWithReason(
    level: ClusteredKeyLevel,
    tReport: ReportTranslator,
    formatPrice: ReportPriceFormatter
): string {
    const confluence =
        level.count > 1 ? tReport('levelConvergence', { v0: level.count }) : '';
    return `${formatPrice(level.price)} (${level.reason}${confluence})`;
}

function buildTitle(symbol: string, tReport: ReportTranslator): string {
    return tReport('reportTitle', { v0: symbol.toUpperCase() });
}

/** 조건부 항목 목록에서 빠진(`null`) 항목을 걷어낸다. */
function presentLines(lines: readonly (string | null)[]): string[] {
    return lines.filter((line): line is string => line !== null);
}

/** 제목 + 항목 줄로 된 블록. 항목이 없으면 블록 자체를 생략(`null`)한다. */
function headedBlock(heading: string, lines: readonly string[]): string | null {
    return lines.length === 0 ? null : [heading, ...lines].join('\n');
}

function buildInterpretation(
    analysis: AnalysisResponse,
    supportLevels: ClusteredKeyLevel[],
    resistanceLevels: ClusteredKeyLevel[],
    t: EnumLabelTranslator,
    tReport: ReportTranslator,
    formatPrice: ReportPriceFormatter
): string {
    const levelNote = (key: string, levels: ClusteredKeyLevel[]) =>
        levels.length > 0
            ? tReport(key, {
                  v0: formatPriceList(
                      levels.map(level => level.price),
                      formatPrice
                  ),
              })
            : null;

    return presentLines([
        tReport('trendSummary', {
            v0: t(TREND_LABEL_KEY[analysis.trend]),
            v1: t(TREND_INTERPRETATION_KEY[analysis.trend]),
            v2: t(RISK_LABEL_KEY[analysis.riskLevel]),
        }),
        normalizeWhitespace(analysis.summary),
        levelNote('resistanceNote', resistanceLevels),
        levelNote('supportNote', supportLevels),
    ]).join(' ');
}

function buildKeyLevelsBlock(
    keyLevels: ClusteredKeyLevels,
    effectiveLevels: EffectiveActionLevels,
    tReport: ReportTranslator,
    formatPrice: ReportPriceFormatter
): string | null {
    const levelLine = (key: string, levels: ClusteredKeyLevel[]) =>
        levels.length > 0
            ? tReport(key, {
                  v0: levels
                      .map(level =>
                          formatLevelWithReason(level, tReport, formatPrice)
                      )
                      .join(', '),
              })
            : null;
    const priceListLine = (key: string, prices: number[] | undefined) =>
        prices?.length
            ? tReport(key, { v0: formatPriceList(prices, formatPrice) })
            : null;
    const { poc } = keyLevels;
    const { entryPrices, stopLoss, takeProfitPrices } = effectiveLevels;

    return headedBlock(
        tReport('keyLevelsHeading'),
        presentLines([
            levelLine('levelsResistance', keyLevels.resistance),
            levelLine('levelsSupport', keyLevels.support),
            poc !== undefined
                ? `- PoC: ${formatPrice(poc.price)} (${poc.reason})`
                : null,
            priceListLine('entryZone', entryPrices),
            stopLoss !== undefined
                ? tReport('invalidation', { v0: formatPrice(stopLoss) })
                : null,
            priceListLine('targetZone', takeProfitPrices),
        ])
    );
}

/** 근거 한 항목 — 이름 아래에 별표(마크다운 강조)를 걷어낸 설명을 들여 쓴다. */
function formatEvidenceLine(name: string, description: string): string {
    return `- ${name}\n  - ${normalizeWhitespace(description).replace(/\*/g, '')}`;
}

/**
 * 근거 블록. 패널과 같은 선별(`selectPanelSkillResults`)을 거친다 — 패턴으로 이미
 * 실린 전략·지표가 두 번 나오거나 패널의 "N개 스킬 감지"와 개수가 어긋나지 않게.
 */
function buildEvidenceBlock(
    analysis: AnalysisResponse,
    tReport: ReportTranslator,
    skillLabel: (name: string) => string
): string | null {
    const { detectedPatterns, strategies, indicatorResults } =
        selectPanelSkillResults(analysis);

    const lines = [
        ...indicatorResults.flatMap(result =>
            result.signals.map(signal =>
                formatEvidenceLine(
                    skillLabel(result.indicatorName),
                    signal.description
                )
            )
        ),
        ...detectedPatterns.map(pattern =>
            formatEvidenceLine(skillLabel(pattern.skillName), pattern.summary)
        ),
        ...strategies.map(strategy =>
            formatEvidenceLine(
                skillLabel(strategy.strategyName),
                strategy.summary
            )
        ),
    ];

    return headedBlock(tReport('evidenceHeading'), lines);
}

function buildScenarioBlock(
    analysis: AnalysisResponse,
    tReport: ReportTranslator,
    formatPrice: ReportPriceFormatter
): string | null {
    const scenarioLine = (key: string, scenario: PriceScenario | null) =>
        scenario && scenario.targets.length > 0
            ? tReport(key, {
                  v0: normalizeWhitespace(scenario.condition),
                  v1: formatPriceList(
                      scenario.targets.map(target => target.price),
                      formatPrice
                  ),
              })
            : null;
    // priceTargets는 부분 응답에서 누락될 수 있으므로 방어적으로 기본값을 둔다.
    const priceTargets = analysis.priceTargets ?? {
        bullish: null,
        bearish: null,
    };

    return headedBlock(
        tReport('scenarioHeading'),
        presentLines([
            scenarioLine('upside', priceTargets.bullish),
            scenarioLine('downside', priceTargets.bearish),
        ])
    );
}

function buildResponseStance(
    analysis: AnalysisResponse,
    keyLevels: ClusteredKeyLevels,
    effectiveLevels: EffectiveActionLevels,
    t: EnumLabelTranslator,
    tReport: ReportTranslator,
    formatPrice: ReportPriceFormatter
): string {
    const { actionRecommendation } = analysis;

    if (actionRecommendation?.entryRecommendation !== undefined) {
        const base = t(
            ENTRY_STANCE_KEY[actionRecommendation.entryRecommendation]
        );
        const entryAnchor = effectiveLevels.entryPrices?.length
            ? tReport('entryAnchor', {
                  v0: formatPriceList(effectiveLevels.entryPrices, formatPrice),
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

/** 리스크 블록 — 리스크 등급 문장 뒤에 실효 손익비를 붙인다. */
function buildRiskNote(
    analysis: AnalysisResponse,
    tReport: ReportTranslator
): string {
    const { riskLevel, actionRecommendation } = analysis;
    const prefix = tReport(RISK_NOTE_KEY[riskLevel]);

    // 손익비도 실효값을 싣는다 — core가 레벨을 보정했으면 원본 `riskReward`는
    // 이미 거부된 손절·목표 기준이라, 같은 리포트의 핵심 레벨 블록(보정값)과 모순된다.
    const reconciledRiskReward =
        actionRecommendation?.reconciledLevels?.riskReward ?? '';
    const riskReward =
        reconciledRiskReward !== ''
            ? reconciledRiskReward
            : actionRecommendation?.riskReward;
    const suffix =
        riskReward !== undefined ? normalizeWhitespace(riskReward) : '';

    return normalizeWhitespace([prefix, suffix].join(' '));
}

/**
 * 분석 결과를 복사·공유용 평문 전문가 리포트로 직렬화한다(순수 함수).
 * 번역자·표시명 함수는 호출 훅(`useCopyAnalysisReport`)이 주입한다.
 */
export function buildExpertAnalysisReport({
    symbol,
    krxTickTable = 'share',
    analysis,
    keyLevels,
    t,
    tReport,
    skillLabel,
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

    const formatPrice = reportPriceFormatter(symbol, krxTickTable);

    const sections = [
        buildTitle(symbol, tReport),
        buildInterpretation(
            analysis,
            supportLevels,
            resistanceLevels,
            t,
            tReport,
            formatPrice
        ),
        buildKeyLevelsBlock(
            safeKeyLevels,
            effectiveLevels,
            tReport,
            formatPrice
        ),
        buildEvidenceBlock(analysis, tReport, skillLabel),
        buildScenarioBlock(analysis, tReport, formatPrice),
        `${tReport('responseStance')}
${buildResponseStance(analysis, safeKeyLevels, effectiveLevels, t, tReport, formatPrice)}`,
        `${tReport('riskLabel')}
${buildRiskNote(analysis, tReport)}`,
        tReport('source', { v0: symbol }),
    ].filter(
        (section): section is string => section !== null && section !== ''
    );

    return sections.join('\n\n');
}
