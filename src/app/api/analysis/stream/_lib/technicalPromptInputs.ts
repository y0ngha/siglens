import type { Timeframe } from '@y0ngha/siglens-core';
import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import { listEarningsDates } from '@/entities/earnings-report/api';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
import type { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { getDatabaseClient } from '@/shared/db/client';

/** core `runAnalysis`의 프롬프트 입력으로 그대로 펼쳐 넘기는 세 값. */
export interface TechnicalPromptInputs {
    priorAnalyses: Awaited<
        ReturnType<DrizzleAnalysisHistoryRepository['findRecentForPrompt']>
    >;
    marketEvents: Awaited<ReturnType<typeof findMarketEventsForPrompt>>;
    earningsDates: Awaited<ReturnType<typeof listEarningsDates>>;
}

/**
 * technical 분석 프롬프트 입력(이력·시장 이벤트·실적일)을 한 번에 읽는다. 서로 독립이라 왕복을 겹친다.
 *
 * core가 `priorAnalyses` 지문을 캐시 키에 접으므로 `runAnalysis` 호출 **전에** 확정돼야 한다(미스 때로
 * 미루면 키 계산과 프롬프트 렌더가 같은 요청에 서로 다른 이력을 본다). 반면 동시성 상한 검사 **뒤**에서
 * 불러야 한다 — 503으로 거절될 요청이 이 인덱스 쿼리를 내지 않게 해서 용량 급증 때 DB 부하를 얹지 않는다.
 * 봇 요청도 건너뛰지 않는다: 봇의 캐시 미스도 사람과 똑같이 생성하므로 건너뛰면 같은 캐시 키에 프롬프트
 * 입력만 다른 두 벌의 본문이 생긴다.
 *
 * `session`은 core에 넘기는 것과 같은 값이어야 한다 — 이력 경계와 1Day 이벤트 창이 core 캐시 키·만료
 * 경계와 맞는다. 실적일은 실패하면 `undefined`(캘린더 모름, 안전 쪽)이고 캐시 키에 접히지 않는다.
 */
export async function loadTechnicalPromptInputs(input: {
    symbol: string;
    timeframe: Timeframe;
    session: ReturnType<typeof sessionSpecFor>;
}): Promise<TechnicalPromptInputs> {
    const { symbol, timeframe, session } = input;
    const db = getDatabaseClient().db;
    const [priorAnalyses, marketEvents, earningsDates] = await Promise.all([
        new DrizzleAnalysisHistoryRepository(db).findRecentForPrompt({
            symbol,
            timeframe,
            tab: 'technical',
            session,
        }),
        findMarketEventsForPrompt(db, {
            symbol,
            ...marketEventsLookback(timeframe, session),
        }),
        listEarningsDates(symbol, db),
    ]);
    return { priorAnalyses, marketEvents, earningsDates };
}
