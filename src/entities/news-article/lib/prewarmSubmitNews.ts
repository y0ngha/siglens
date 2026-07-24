import 'server-only';
import {
    submitNewsAnalysis,
    DEEPSEEK_V4_FLASH_MODEL,
    type EnrichedNewsItem,
    type SubmitNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { NEWS_ANALYSIS_LOOKBACK_MS } from './newsLookback';
import { buildAnalysisNewsItems } from './buildAnalysisNewsItems';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { resolveAssetClass } from '@/entities/ticker/lib/resolveAssetClass';

/**
 * SEO pre-warm 전용 news submit (spec 2026-07-24 §4 seam, Task 7).
 * `submitNewsAnalysisAction`의 비봇 경로를 요청-컨텍스트 없이 재현한다
 * (캐시 키 5축 정합: model default / tier free / reasoning false / 동일
 * fingerprint). 차이는 skipEnqueueIfMiss:false와 force 뿐.
 *
 * modelId는 익명/free 방문자가 실제로 보내는 기본값(`DEEPSEEK_V4_FLASH_MODEL`
 * — `SymbolModelContext`의 `useSelectedModel` 기본값과 동일)을 명시 전달한다.
 * core의 news submit 옵션은 `modelId`를 그대로 캐시 키에 사용하고 내부
 * fallback이 없으므로, 생략하면 익명 writer가 쓰는 키와 어긋난다.
 *
 * ⚠️ 요청 헤더 읽기·세션 사용자 조회·봇 판별·쿠키 접근 금지 — cron의
 * after() 컨텍스트에서 실행되며 React 요청 스코프가 없다.
 */
export async function prewarmNews(
    symbol: string,
    companyName: string,
    force: boolean
): Promise<SubmitNewsAnalysisResult> {
    const assetClass = await resolveAssetClass(symbol);
    const { db } = getDatabaseClient();
    const [rows, next] = await Promise.all([
        new DrizzleNewsRepository(db).listBySymbol(
            symbol,
            NEWS_ANALYSIS_LOOKBACK_MS
        ),
        getNextEarningsReport(symbol, db),
    ]);
    const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
        buildAnalysisNewsItems(rows);

    return submitNewsAnalysis({
        symbol,
        companyName,
        modelId: DEEPSEEK_V4_FLASH_MODEL,
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        tier: 'free',
        reasoning: false,
        skipEnqueueIfMiss: false,
        assetClass,
        ...(force ? { force: true } : {}),
    });
}
