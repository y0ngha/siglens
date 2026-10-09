import type { OptionsExpirationMetrics, Trend } from '@y0ngha/siglens-core';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    REPORT_MAX_NEWS,
    REPORT_MAX_PATTERNS,
    type SymbolReport,
    type SymbolReportNews,
} from '../reportModel';

/** 스냅샷에서 좁혀 온 기술적 분석 — `narrowTechnicalContent`의 결과 모양. */
export interface TechnicalSource {
    summary: string;
    trend: Trend | null;
    patternSummaries: ReadonlyArray<{ summary: string }>;
}

/** 스냅샷에서 좁혀 온 옵션 분석 요약. */
export interface OptionsProseSource {
    summary: string;
}

export interface BuildSymbolReportInput {
    symbol: string;
    technical: TechnicalSource | null;
    plain: string | null;
    analyzedAt: Date | null;
    news: readonly NewsDisplayItem[];
    optionsMetrics: OptionsExpirationMetrics | null;
    optionsProse: OptionsProseSource | null;
}

function toNews(item: NewsDisplayItem): SymbolReportNews {
    return {
        title: item.titleLocalized ?? item.titleKo ?? item.titleEn,
        summary: item.summaryLocalized ?? item.summaryKo,
        sentiment: item.sentiment,
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt,
    };
}

/**
 * 메일에 실을 뉴스를 고른다. AI 요약이 붙은 기사를 먼저, 같은 그룹 안에서는 최신순.
 * 요약 없는 기사만 있으면 제목이라도 싣는다 — 빈 칸보다 낫다.
 */
export function pickReportNews(
    items: readonly NewsDisplayItem[],
    limit: number = REPORT_MAX_NEWS
): SymbolReportNews[] {
    const hasSummary = (item: NewsDisplayItem) =>
        (item.summaryLocalized ?? item.summaryKo) != null;
    return items
        .toSorted((a, b) => {
            const bySummary = Number(hasSummary(b)) - Number(hasSummary(a));
            if (bySummary !== 0) return bySummary;
            return b.publishedAt.localeCompare(a.publishedAt);
        })
        .slice(0, limit)
        .map(toNews);
}

/** 종목 한 칸의 리포트 데이터를 조립한다(순수 함수 — 소스 조회는 호출자 몫). */
export function buildSymbolReport(input: BuildSymbolReportInput): SymbolReport {
    const technical =
        input.technical === null
            ? null
            : {
                  summary: input.technical.summary,
                  trend: input.technical.trend,
                  patterns: input.technical.patternSummaries
                      .map(p => p.summary)
                      .filter(summary => summary.length > 0)
                      .slice(0, REPORT_MAX_PATTERNS),
              };
    const metrics = input.optionsMetrics;
    const options =
        metrics === null && input.optionsProse === null
            ? null
            : {
                  expirationDate: metrics?.expirationDate ?? '',
                  putCallRatio: metrics?.putCallRatio ?? null,
                  atmImpliedVolatility: metrics?.atmImpliedVolatility ?? null,
                  impliedMovePercent: metrics?.impliedMovePercent ?? null,
                  summary: input.optionsProse?.summary || null,
              };
    return {
        symbol: input.symbol,
        technical,
        plain: input.plain,
        news: pickReportNews(input.news),
        options,
        analyzedAt:
            technical === null || input.analyzedAt === null
                ? null
                : input.analyzedAt.toISOString(),
    };
}
