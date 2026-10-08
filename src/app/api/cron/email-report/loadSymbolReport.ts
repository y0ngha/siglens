import 'server-only';
import {
    summarizeChainForLlm,
    type OptionsExpirationMetrics,
} from '@y0ngha/siglens-core';
import { buildSymbolReport } from '@/entities/email-report/lib/buildSymbolReport';
import type { SymbolReport } from '@/entities/email-report/reportModel';
import { getNewsList } from '@/entities/news-article/api';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/lib/optionsDataCache';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { narrowOptionsContent } from '@/entities/seo-snapshot/lib/optionsContent';
import { narrowTechnicalContent } from '@/entities/seo-snapshot/lib/technicalContent';
import {
    SNAPSHOT_MAX_AGE_MS,
    type SeoAnalysisSnapshot,
} from '@/entities/seo-snapshot/model';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';
import type { NewsDisplayItem } from '@/shared/lib/types';

/** 종목 한 칸을 채우는 읽기 소스. 테스트가 갈아 끼울 수 있게 주입받는다. */
export interface SymbolReportSources {
    findSnapshots: (
        symbol: string,
        locale: Locale
    ) => Promise<SeoAnalysisSnapshot[]>;
    getNews: (symbol: string, locale: Locale) => Promise<NewsDisplayItem[]>;
    getOptionsMetrics: (
        symbol: string
    ) => Promise<OptionsExpirationMetrics | null>;
}

/**
 * 가장 가까운 만기(당일 만기는 건너뜀)의 옵션 지표. 옵션 시장이 없는 종목은 `null`.
 *
 * 만기 선택은 챗 도구(`getOptionsSummaryTool`)와 같다 — 당일 만기는 예상 변동폭이
 * `null`이라 하루 이상 남은 첫 만기를 쓰고, 전부 당일이면 첫 만기로 떨어진다.
 */
async function readOptionsMetrics(
    symbol: string
): Promise<OptionsExpirationMetrics | null> {
    if (!(await isTabAllowedForSymbol(symbol, 'options'))) return null;
    if (!(await hasOptionsMarket(symbol))) return null;
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (snapshot === null || snapshot.chains.length === 0) return null;
    const chain =
        snapshot.chains.find(c => c.daysToExpiration >= 1) ??
        snapshot.chains[0]!;
    return summarizeChainForLlm(chain, snapshot.underlyingPrice);
}

/** 운영 소스 — 전부 저장된 결과를 읽기만 한다(LLM 호출 없음). */
export function createSymbolReportSources(): SymbolReportSources {
    const { db } = getDatabaseClient();
    const snapshots = new DrizzleSeoSnapshotRepository(db);
    return {
        findSnapshots: (symbol, locale) =>
            snapshots.findBySymbol(symbol, locale),
        getNews: getNewsList,
        getOptionsMetrics: readOptionsMetrics,
    };
}

/** 소스 하나의 실패가 종목 칸 전체를 지우지 않게 한다 — 실패한 섹션만 비운다. */
async function settle<T>(
    label: string,
    symbol: string,
    work: () => Promise<T>,
    fallback: T
): Promise<T> {
    try {
        return await work();
    } catch (error) {
        console.warn(
            `[email-report] ${label} unavailable for ${symbol}`,
            error
        );
        return fallback;
    }
}

function isFresh(snapshot: SeoAnalysisSnapshot | undefined, now: Date) {
    return (
        snapshot !== undefined &&
        now.getTime() - snapshot.generatedAt.getTime() <= SNAPSHOT_MAX_AGE_MS
    );
}

/**
 * 종목 한 칸의 리포트 데이터를 모은다.
 *
 * 분석 산문은 프리웜 cron이 구워 둔 SEO 스냅샷에서만 읽는다 — **새 AI 분석을 돌리지
 * 않는다**. 그 스냅샷은 무료 등급으로 걸러진 결과라 진입가·손절가·목표가가 없고,
 * 메일 발송이 회원 수만큼 LLM 비용을 만들지도 않는다. 스냅샷이 없거나 7일보다 오래된
 * 종목은 분석 칸을 비우고 차트·뉴스·옵션 지표만 싣는다.
 */
export async function loadSymbolReport(
    symbol: string,
    locale: Locale,
    now: Date,
    sources: SymbolReportSources
): Promise<SymbolReport> {
    const [snapshots, news, optionsMetrics] = await Promise.all([
        settle(
            'snapshots',
            symbol,
            () => sources.findSnapshots(symbol, locale),
            []
        ),
        settle('news', symbol, () => sources.getNews(symbol, locale), []),
        settle(
            'options',
            symbol,
            () => sources.getOptionsMetrics(symbol),
            null
        ),
    ]);

    const technicalRow = snapshots.find(s => s.tab === 'technical');
    const optionsRow = snapshots.find(s => s.tab === 'options');
    const technical = isFresh(technicalRow, now)
        ? narrowTechnicalContent(technicalRow!.content)
        : null;
    const optionsProse = isFresh(optionsRow, now)
        ? narrowOptionsContent(optionsRow!.content)
        : null;

    return buildSymbolReport({
        symbol,
        technical,
        plain: technical === null ? null : (technicalRow!.plain ?? null),
        analyzedAt: technical === null ? null : technicalRow!.generatedAt,
        news,
        optionsMetrics,
        optionsProse,
    });
}
