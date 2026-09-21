import 'server-only';
import {
    DrizzleNewsRepository,
    ingestNewsForSymbol,
    isRecentlyFetched,
    NEWS_ANALYSIS_LOOKBACK_MS,
} from '@/entities/news-article/api';
import { getDatabaseClient } from '@/shared/db/client';
import { revalidateTag } from 'next/cache';

/**
 * 챗 툴이 심볼 데이터를 읽기 **전에** 돌리는 수급 단계.
 *
 * ## 왜 필요한가
 *
 * 챗의 `get_news`는 `listCardsBySymbol`로 **DB만 읽었다**. 적재(ingest)를 트리거하는
 * 경로는 뉴스 탭 방문(`ensureNewsCardsAnalyzedAction`)과 prewarm cron 둘뿐이라,
 * 둘 다 안 돌면 DB가 며칠씩 정체된 채 그대로 답으로 나갔다.
 *
 * 실측(2026-09-21): 사용자가 LAES의 당일 보도자료를 물었을 때 FMP에는 그 기사가
 * **이미 있었는데** 챗은 "가장 최근 것이 2026-09-17(89시간 전)"이라고 답했다.
 * 뉴스가 없어서가 아니라 아무도 적재를 부르지 않아서였다.
 *
 * ## 왜 "무조건 최신화"가 아니라 게이트인가
 *
 * 질문마다 무조건 적재하면 FMP 왕복이 질문 수에 비례해 늘고, 같은 심볼을 연달아
 * 묻는 대화에서 그대로 증폭된다. 이미 같은 목적의 장치가 있다 —
 * `newsRefreshFlag`(Redis, TTL 10분). 뉴스 탭 방문 경로가 쓰는 바로 그 플래그이고,
 * 봇 연타 방어까지 이미 들어 있다. 챗만 이걸 안 쓰고 있었을 뿐이라 그대로 재사용한다.
 *
 * ## 계약
 *
 * - **절대 throw하지 않는다.** 수급 실패가 질문 자체를 죽이면 안 된다 — DB에 있는
 *   것으로 답하는 편이 낫다. 반환값은 진단용이며(지금은 테스트만 읽는다) 호출부
 *   `ToolRuntime.ensureSymbolData`는 이를 버리고 `void`로 접는다.
 * - **카드 보강(LLM 번역·라벨)은 여기서 하지 않는다.** 백그라운드로 띄우지도
 *   않는다 — 보강은 뉴스 탭 방문 경로(`ensureNewsCardsAnalyzedAction`)와 prewarm
 *   cron이 담당한다. 그래도 이 턴에 효과가 있는 이유는 `listCardsBySymbol`이
 *   미보강 행도 돌려주기 때문이다: 제목·발행일·링크는 즉시 보이고, 감성·분류
 *   라벨만 다음 보강 패스까지 빈다. 보강까지 기다리면 기사 수만큼 LLM 왕복이
 *   대화 지연에 그대로 얹힌다.
 */
export interface SymbolFreshnessResult {
    /** 이번 호출이 실제로 외부 수급을 돌렸는가(false = TTL 내라 건너뜀). */
    refreshed: boolean;
    /** 새로 적재/변경된 기사 수. `refreshed`가 false면 0. */
    changedCount: number;
}

const SKIPPED: SymbolFreshnessResult = { refreshed: false, changedCount: 0 };

export async function ensureSymbolNewsFresh(
    symbol: string
): Promise<SymbolFreshnessResult> {
    try {
        // Redis 미설정/장애 시 false를 돌려주므로 그때는 항상 적재한다 — 이 경로의
        // 기존 동작(`ensureNewsCardsAnalyzedAction`)과 같다.
        if (await isRecentlyFetched(symbol)) return SKIPPED;

        const { db } = getDatabaseClient();
        const repo = new DrizzleNewsRepository(db);
        // 창을 **명시적으로** 30일로 좁힌다. 기본값은 `NEWS_LOOKBACK_MS`(180일)인데,
        // 이 게이트가 먹여 살리는 소비자는 전부 30일 이하만 읽는다 — `get_news`는
        // 30일로 clamp하고(`MAX_LOOKBACK_MS`), `run_fresh_analysis`의 뉴스 경로는
        // `NEWS_ANALYSIS_LOOKBACK_MS`를 쓴다. 180일치를 받으면 읽지도 않을 기사를
        // Neon에 쓰느라 왕복이 6배가 되는데, 그 비용이 **대화 지연에 그대로 얹힌다**.
        // `prewarmNews`가 cron 경로에서 같은 이유로 이미 좁혀 둔 것을 따른다(감사 F5).
        const ingested = await ingestNewsForSymbol(
            symbol,
            repo,
            NEWS_ANALYSIS_LOOKBACK_MS
        );
        if (ingested === null) return SKIPPED;

        const changedCount = ingested.upsertSettled.filter(
            r => r.status === 'fulfilled' && r.value === true
        ).length;

        // 실제로 바뀐 행이 있을 때만 무효화한다. 방문마다 무효화하면 빈도 폭풍이
        // 되는데, `upsertNewsItem`이 값이 바뀐 행만 RETURNING하므로 같은 기사
        // 재fetch는 changedCount=0이 된다(뉴스 탭 경로와 같은 판단).
        if (changedCount > 0) {
            revalidateTag(`news:${symbol.toUpperCase()}`, 'max');
        }
        return { refreshed: true, changedCount };
    } catch (error) {
        // NewsIngestWriteError(DB 광역 장애)를 포함해 전부 삼킨다 — 위 계약 참고.
        console.error('[ensureSymbolNewsFresh]', symbol, error);
        return SKIPPED;
    }
}
