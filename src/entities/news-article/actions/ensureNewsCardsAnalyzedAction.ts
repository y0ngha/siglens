'use server';

import { revalidateTag } from 'next/cache';
import { getDatabaseClient } from '@/shared/db/client';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isE2E } from '@/shared/api/e2eEnv';
import { DrizzleNewsRepository } from '../api';
import { analyzeNewsCards } from '../lib/analyzeNewsCards';
import {
    countChangedRows,
    ingestNewsForSymbol,
    NewsIngestWriteError,
    type NewsIngestResult,
} from '../lib/ingestNewsForSymbol';
import { VISITOR_NEWS_CARD_LIMIT } from '../lib/newsAnalysisConstants';
import { newsCacheTag } from '../lib/newsCacheTag';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import { withNewsCardAnalysisLock } from '../server/newsCardAnalysisLock';
import {
    shortenNewsRefreshClaim,
    tryClaimNewsRefresh,
} from '../server/newsRefreshFlag';

/**
 * 적재를 돌린다. 실패하면(소스 실패 = `null`, DB 쓰기 실패, 그 밖의 예외) 앞에서 잡은
 * 10분 선점을 짧은 재시도 간격으로 줄인다 — 실패 한 번이 10분 갱신 공백이 되지 않게
 * 한다(`NEWS_REFRESH_RETRY_TTL_SECONDS` JSDoc).
 *
 * `NewsIngestWriteError`(과반 upsert 실패, DB 광역 장애 추정)는 여기서 삼킨다 — 이
 * 액션은 fire-and-forget 계약(SERVER.md#SA-6)이라 이 오류로 throw해선 안 된다.
 * `prewarmNews`(cron)는 반대로 이 throw를 위로 올려보내 배치의 유닛 단위 catch가 빈
 * 스냅샷을 굳히지 않고 다음 tick에 재시도하게 한다.
 */
async function ingestOrReleaseClaim(
    symbol: string,
    repo: DrizzleNewsRepository
): Promise<NewsIngestResult | null> {
    try {
        const result = await ingestNewsForSymbol(symbol, repo);
        if (result === null) await shortenNewsRefreshClaim(symbol);
        return result;
    } catch (err) {
        await shortenNewsRefreshClaim(symbol);
        if (err instanceof NewsIngestWriteError) {
            console.error(
                `[ensureNewsCardsAnalyzedAction] ingest failed for ${symbol}:`,
                err
            );
            return null;
        }
        throw err;
    }
}

/**
 * Server Action: 심볼의 최신 뉴스를 받아 DB에 upsert하고, 미분석 기사마다 카드 AI 분석을
 * 돌려 결과를 같은 패스에서 DB에 남긴다.
 *
 * DB-first: `analyzedAt`이 이미 찍힌 기사는 건너뛴다 — 카드 분석 결과의 1차 저장소는
 * DB다. 기사별 오류는 로그만 남기고 던지지 않으며 나머지 기사는 계속 진행한다.
 *
 * `useNewsAnalysisTrigger`가 `useEffect`에서 fire-and-forget으로 부른다.
 *
 * 인증 없는 공개 액션이라 `symbol`은 임의 값이다. 종목 형상 검사를 통과한 값만 받는다 —
 * 아무 문자열로 FMP 조회·Redis 키·LLM 분석을 만들 수 없게 한다. 통과한 값은 대문자로
 * 정규화해 쓴다: 소문자 요청이 DB의 `symbol` 컬럼을 소문자로 덮어쓰거나(`news.id` 충돌
 * upsert가 `symbol`을 갱신한다) 대문자 키로 저장된 분석 완료 집합을 놓치지 않게 한다.
 *
 * @param options.skipAnalysis true면 적재(fetch + upsert)만 하고 LLM 카드 분석은 건너뛴다.
 */
export async function ensureNewsCardsAnalyzedAction(
    rawSymbol: unknown,
    options?: { skipAnalysis?: boolean }
): Promise<void> {
    if (typeof rawSymbol !== 'string' || !isAdmissibleSymbolShape(rawSymbol)) {
        return;
    }
    const symbol = rawSymbol.toUpperCase();

    // 최근 TTL(10분) 안에 적재했으면 소스 재조회와 기사 수만큼의 DB upsert를 건너뛴다.
    // 이 가드가 없으면 매 마운트마다 180일 FMP 조회와 기사 수만큼 Neon 왕복을 다시 한다
    // — 대부분은 값이 안 바뀌어 `setWhere`로 UPDATE도 안 되는 no-op인데 왕복 비용은
    // 그대로 든다. 봇은 JS를 실행하지 않아 트리거 자체를 안 타므로 봇/사람 구분 없이
    // 같은 플래그를 건다(시장 뉴스 형제 경로 `ensureMarketNewsCardsAnalyzedAction`과 같은
    // 10분 정책).
    //
    // 이 액션은 fire-and-forget이라 트리거를 쏜 본인의 화면에는 결과가 반영되지 않는다
    // (그 렌더는 이미 끝났다). 적재 결과는 `revalidateTag` 이후의 다음 렌더에 들어가므로,
    // TTL의 대가는 10분 안에 들어온 다음 방문자가 최대 10분 된 목록을 본다는 것뿐이다.
    // prewarm cron은 이 액션이 아니라 `ingestNewsForSymbol`을 직접 부르므로 스냅샷·SEO
    // 경로의 신선도는 이 가드와 무관하다.
    //
    // 확인과 표시를 **한 번에**(SET NX) 한다 — GET 뒤 SET이면 동시에 들어온 방문자들이
    // 모두 "아직 안 함"을 읽고 같은 적재·분석을 중복으로 돌린다.
    if (!(await tryClaimNewsRefresh(symbol))) return;

    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    const ingestResult = await ingestOrReleaseClaim(symbol, repo);
    if (ingestResult === null) return;
    const { fresh } = ingestResult;

    // 새 뉴스가 하나도 없으면(fresh 빈) 무효화·분석 모두 불필요하다 — unanalyzed도 항상
    // 빈 배열이 되므로 listAnalyzedIds DB 쿼리를 건너뛴다. (fresh.length>0이지만 모두
    // no-op인 경우는 아래로 진행해 미분석 기존 기사를 분석한다.)
    if (fresh.length === 0) return;

    // 실제로 신규 삽입/내용 변경된 기사가 1건 이상일 때만 news ISR 캐시를 무효화한다
    // (`countChangedRows` 주석 참고). 단, 분석 단계는 변경 수와 무관하게 진행한다 —
    // 이전 호출에서 분석 실패로 analyzedAt=null로 남은 기존 기사를 재fetch(no-op)에서도
    // 다시 분석해야 하기 때문이다.
    if (countChangedRows(ingestResult) > 0) {
        // news 태그만 무효화하므로 bars/peek/profile 캐시는 보존한다. 'max'는 최대
        // stale-while-revalidate 프로필이라 이 태그가 즉시 만료된다.
        revalidateTag(newsCacheTag(symbol), 'max');
    }

    if (isE2E()) return;

    if (options?.skipAnalysis) return;

    // upsert 이후 DB 상태를 읽어 방금 들어온 행을 포함한다. 필요한 건 "이미 분석됨"
    // 집합뿐이라 id만 읽는다 — 전 컬럼을 읽으면 본문까지 받아서 그대로 버린다.
    const analyzedIds = await repo.listAnalyzedIds(symbol, NEWS_LOOKBACK_MS);
    const unanalyzed = fresh.filter(item => !analyzedIds.has(item.id));

    if (unanalyzed.length === 0) return;

    // 마감이 없다는 것과 비용이 없다는 것은 다르다 — 이 경로의 적재 lookback은 180일이고
    // FMP 상한이 1,000건이라, 백로그가 쌓인 종목의 첫 마운트 한 번이 최악 1,000회 LLM
    // 왕복이 된다(상한 근거는 `VISITOR_NEWS_CARD_LIMIT` JSDoc).
    //
    // prewarm이 같은 심볼을 분석 중이면 건너뛴다 — 그쪽이 끝나면 행이 채워지고, 남은
    // 기사는 다음 방문이 이어받는다.
    await withNewsCardAnalysisLock(symbol, () =>
        analyzeNewsCards(unanalyzed, repo, {
            limit: VISITOR_NEWS_CARD_LIMIT,
            logLabel: 'ensureNewsCardsAnalyzedAction',
        })
    );
}
