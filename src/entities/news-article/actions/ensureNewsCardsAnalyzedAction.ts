'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import {
    ingestNewsForSymbol,
    NewsIngestWriteError,
} from '../lib/ingestNewsForSymbol';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import { isRecentlyFetched } from '../lib/newsRefreshFlag';
import { revalidateTag } from 'next/cache';
import { isE2E } from '@/shared/api/e2eEnv';
import { analyzeNewsCards } from '../lib/analyzeNewsCards';
import { VISITOR_NEWS_CARD_LIMIT } from '../lib/newsAnalysisConstants';

/**
 * Server Action: fetch fresh FMP news for `symbol`, upsert to DB, and
 * trigger per-card AI analysis for each item — polling until each worker
 * finishes so the result is persisted to DB in the same pass.
 *
 * DB-first: items that already have `analyzedAt` set are skipped — the DB
 * is the primary store for news-card analysis results.
 *
 * Designed to run inside `waitUntil` so it doesn't block the response stream.
 * Per-item errors are logged and never thrown; other items continue normally.
 *
 * @param options.skipAnalysis When true (bot traffic), FMP fetch + DB upsert
 *   still run but LLM card analysis is skipped to avoid unnecessary worker cost.
 */
export async function ensureNewsCardsAnalyzedAction(
    symbol: string,
    options?: { skipAnalysis?: boolean }
): Promise<void> {
    // 최근 TTL(10분) 내에 fetch했으면 FMP 재조회와 기사 수만큼의 DB upsert를 스킵한다.
    //
    // 원래 이 가드가 `skipAnalysis` 뒤에 걸려 있어 사실상 죽어 있었다 — 그 옵션을
    // 넘기는 프로덕션 호출부가 없다(봇은 JS를 실행하지 않아 트리거 자체를 안 탄다,
    // `useNewsAnalysisTrigger` 주석 참고). 그래서 **매 마운트마다** 180일 FMP 조회와
    // 기사 수만큼 Neon 왕복을 다시 했다. 대부분은 값이 안 바뀌어 `setWhere`로 UPDATE도
    // 안 되는 no-op인데 왕복 비용은 그대로 든다(감사: 비용 확인 패스).
    //
    // "사람 경로는 항상 fresh"라는 원래 의도는 실제로 성립하지 않았다: 이 액션은
    // `useEffect`에서 fire-and-forget으로 나가므로 **트리거를 쏜 본인의 화면에는
    // 반영되지 않는다**(그 렌더는 이미 끝났다). 적재 결과는 `revalidateTag` 이후의
    // 다음 렌더에 들어간다. 즉 TTL의 대가는 10분 안에 들어온 다음 방문자가 최대
    // 10분 된 목록을 본다는 것뿐이고, FMP 수집 지연과 페이지 ISR 주기 안에 묻힌다.
    //
    // 시장 뉴스 형제 경로(`ensureMarketNewsCardsAnalyzedAction`)는 같은 플래그를
    // 이미 봇·사람 구분 없이 걸고 있다 — TTL도 같은 10분이다. 이제 두 뉴스 경로의
    // 정책이 일치한다.
    //
    // prewarm cron은 이 액션이 아니라 `ingestNewsForSymbol`을 직접 부르므로
    // 스냅샷·SEO 경로의 신선도는 이 가드와 무관하다.
    if (await isRecentlyFetched(symbol)) {
        return;
    }

    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    // FMP fetch + DB upsert + failure aggregation + markFetched는
    // ingestNewsForSymbol(lib/)로 추출됨 — prewarmNews(api.ts)도 이 경로를
    // 재사용한다(SEO pre-warm cron의 news livelock 수정, 20%/altcoin 측정치는
    // 그 함수의 doc-comment 참고).
    //
    // NewsIngestWriteError(과반 upsert 실패, DB 광역 장애 추정)는 여기서 삼킨다 —
    // 이 액션은 fire-and-forget 계약(위 docstring, MISTAKES.md "Fire-and-Forget
    // Operations §2")이라 절대 throw해선 안 된다(PR #700 리뷰). prewarmNews(cron)는
    // 반대로 이 throw를 그대로 위로 올려보내야 한다 — 배치의 유닛 단위 catch가
    // 빈 스냅샷을 굳히지 않고 다음 tick에 재시도하도록(감사 F2) — 그 경로는 여기서
    // 건드리지 않는다.
    let ingestResult;
    try {
        ingestResult = await ingestNewsForSymbol(symbol, repo);
    } catch (err) {
        if (err instanceof NewsIngestWriteError) {
            console.error(
                `[ensureNewsCardsAnalyzedAction] ingest failed for ${symbol}:`,
                err
            );
            return;
        }
        throw err;
    }
    if (ingestResult === null) return;
    const { fresh, upsertSettled } = ingestResult;

    // FMP에서 새 뉴스가 하나도 없으면(fresh 빈) 무효화·분석 모두 불필요하다 — unanalyzed도
    // 항상 빈 배열이 되므로 listBySymbol DB 쿼리를 스킵한다. (fresh.length>0이지만 모두 no-op인
    // 경우는 아래로 진행해 미분석 기존 기사를 분석한다 — 회귀 가드.)
    if (fresh.length === 0) return;

    // 실제로 신규 삽입/내용 변경된 기사가 1건 이상일 때만 news ISR 캐시를 무효화한다.
    // upsertNewsItem은 값이 바뀐 행만 RETURNING하므로(setWhere), 같은 기사 재fetch는
    // changedCount=0 → revalidateTag 스킵. 방문마다 무효화하던 빈도 폭풍을 차단한다.
    // 단, 분석(analyze) 단계는 changedCount와 무관하게 진행한다 — 이전 호출에서
    // 분석 실패로 analyzedAt=null로 남은 기존 기사를 재fetch(no-op)에서도 다시 분석해야
    // 하므로(analyze는 listBySymbol로 DB의 모든 미분석 행을 대상으로 함).
    const changedCount = upsertSettled.filter(
        r => r.status === 'fulfilled' && r.value === true
    ).length;
    if (changedCount > 0) {
        // news 태그만 무효화하므로 bars/peek/profile 캐시는 보존(범위 제한).
        // Next.js 16.2.0 revalidateTag signature: (tag: string, profile: string | CacheLifeConfig).
        // 'max' uses the maximum stale-while-revalidate profile so this tag busts immediately.
        // See: node_modules/next/dist/server/web/spec-extension/revalidate.d.ts
        revalidateTag(`news:${symbol.toUpperCase()}`, 'max');
    }

    if (isE2E()) return;

    if (options?.skipAnalysis) return;

    // Read the current DB state after upsert so newly inserted rows are included.
    // 필요한 건 "이미 분석됨" 집합뿐이라 id만 읽는다 — 전 컬럼을 읽으면 본문까지
    // 받아서 그대로 버린다(감사: 비용 라운드 15).
    const analyzedIds = await repo.listAnalyzedIds(symbol, NEWS_LOOKBACK_MS);
    const unanalyzed = fresh.filter(item => !analyzedIds.has(item.id));

    if (unanalyzed.length === 0) return;

    // 마감이 없다는 것과 비용이 없다는 것은 다르다 — 이 경로의 적재 lookback은
    // 180일이고 FMP 상한이 1,000건이라, 백로그가 쌓인 종목의 첫 마운트 한 번이
    // 최악 1,000회 LLM 왕복이 된다(상한 도입 근거는 상수 JSDoc 참조).
    await analyzeNewsCards(unanalyzed, repo, {
        limit: VISITOR_NEWS_CARD_LIMIT,
        logLabel: 'ensureNewsCardsAnalyzedAction',
    });
}
