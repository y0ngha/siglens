import 'server-only';
import type { BarsData } from '@y0ngha/siglens-core';
import {
    DrizzleAnalysisHistoryRepository,
    type ShareableAnalysisRow,
} from '@/entities/analysis/analysisHistoryRepository';
import { narrowChartDrawings } from '@/entities/analysis/lib/narrowChartDrawings';
import { barsUpToDate } from '@/entities/email-report/lib/barsUpToDate';
import { REPORT_CHART_MA_PERIODS } from '@/entities/email-report/lib/chartGeometry';
import { toLegendEntries } from '@/entities/email-report/lib/overlayGeometry';
import { layoutReportChart } from '@/entities/email-report/lib/reportChartLayout';
import type { ReportLegendEntry } from '@/entities/email-report/reportModel';
import { SNAPSHOT_MAX_AGE_MS } from '@/entities/seo-snapshot/model';
import { getDatabaseClient } from '@/shared/db/client';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/** 한 종목의 차트에 그려지는 분석 작도 — 어느 분석인지와 범례. */
export interface SymbolDrawings {
    /** 작도를 가져온 분석이 만들어진 시각. 이미지 URL이 이 시각으로 그 분석을 고정한다. */
    analysisAt: Date;
    legend: ReportLegendEntry[];
}

/** 읽기 소스. 테스트가 갈아 끼울 수 있게 주입받는다. */
export interface SymbolDrawingsSources {
    findLatest: (
        symbols: readonly string[],
        notBefore: Date
    ) => Promise<Map<string, ShareableAnalysisRow>>;
    getDailyBars: (symbol: string) => Promise<BarsData>;
}

/**
 * 운영 소스 — 공유 가능한 최신 분석 한 번의 조회. 일봉은 호출자가 넘긴다: 요약 경로(`loadSymbolBrief`)와 같은 읽기를
 * 나눠 써서 종목마다 한 번만 받고, 동시에 떠 있는 일봉 조회가 요약 경로의 상한(`BRIEF_CONCURRENCY`) 안에 머문다.
 */
export function createSymbolDrawingsSources(
    getDailyBars: SymbolDrawingsSources['getDailyBars']
): SymbolDrawingsSources {
    const { db } = getDatabaseClient();
    const history = new DrizzleAnalysisHistoryRepository(db);
    return {
        findLatest: (symbols, notBefore) =>
            history.findLatestShareable({
                symbols,
                timeframe: '1Day',
                tab: 'technical',
                notBefore,
            }),
        getDailyBars,
    };
}

async function drawingsFor(
    row: ShareableAnalysisRow,
    localDate: string,
    sources: SymbolDrawingsSources
): Promise<SymbolDrawings | null> {
    const drawings = narrowChartDrawings(row.result);
    if (drawings === null) return null;
    const data = await sources.getDailyBars(row.symbol);
    // 이미지 라우트와 같은 자름(`barsUpToDate(bars, date)`)과 같은 배치 함수 — 이미지에 실제로 그려지는 작도만
    // 범례에 오른다. 날짜가 다르면 마지막 봉이 달라져 창·축이 달라지므로 호출자가 날짜별로 부른다.
    const { bars, count } = barsUpToDate(data.bars, localDate);
    const ma = Object.fromEntries(
        REPORT_CHART_MA_PERIODS.map(p => [
            p,
            (data.indicators.ma[p] ?? []).slice(0, count),
        ])
    );
    const layout = layoutReportChart(bars, ma, drawings);
    if (layout === null || layout.drawn === null) return null;
    return {
        analysisAt: row.generatedAt,
        legend: toLegendEntries(
            layout.drawn.drawnItems,
            drawings.overlayLabels
        ),
    };
}

/**
 * 종목들의 작도를 `localDate`(메일 기준일) 시점의 봉으로 모은다 — 분석 조회 한 번(`findLatestShareable`, 7일 이내, 맞춤 아닌 행만)과 종목별 일봉.
 * 그릴 작도가 없거나 읽기가 실패한 종목은 결과에 없다(그 카드는 캔들·이동평균 이미지로 간다). 절대 던지지 않는다.
 */
export async function loadSymbolDrawings(
    symbols: readonly string[],
    localDate: string,
    now: Date,
    sources: SymbolDrawingsSources
): Promise<Map<string, SymbolDrawings>> {
    const found = new Map<string, SymbolDrawings>();
    if (symbols.length === 0) return found;
    const rows = await sources
        .findLatest(symbols, new Date(now.getTime() - SNAPSHOT_MAX_AGE_MS))
        .catch((error: unknown) => {
            console.warn(
                '[email-report] chart drawings unavailable',
                redactDbErrorForLog(error)
            );
            return null;
        });
    if (rows === null) return found;
    await Promise.all(
        [...rows.values()].map(async row => {
            try {
                const drawings = await drawingsFor(row, localDate, sources);
                if (drawings !== null) found.set(row.symbol, drawings);
            } catch (error) {
                console.warn(
                    `[email-report] chart drawings unavailable for ${row.symbol}`,
                    redactDbErrorForLog(error)
                );
            }
        })
    );
    return found;
}
