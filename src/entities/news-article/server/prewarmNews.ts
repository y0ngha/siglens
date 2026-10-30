import 'server-only';
import { revalidateTag } from 'next/cache';
import {
    runNewsAnalysis,
    DEEPSEEK_V4_1_FLASH_MODEL,
    type EnrichedNewsItem,
    type RunNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getNextEarningsReport } from '@/entities/earnings-report/api';
import { loadNewsMacroCalendar } from '@/entities/economy/api/loadNewsMacroCalendar';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { getDatabaseClient } from '@/shared/db/client';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import { PREWARM_PROVIDER_FALLBACK } from '@/shared/config/prewarm';
import { DrizzleNewsRepository, type NewsRow } from '../api';
import { analyzeNewsCards } from '../lib/analyzeNewsCards';
import { buildAnalysisNewsItems } from '../lib/buildAnalysisNewsItems';
import {
    countChangedRows,
    ingestNewsForSymbol,
    NewsIngestWriteError,
    type NewsIngestResult,
} from '../lib/ingestNewsForSymbol';
import { PREWARM_NEWS_CARD_LIMIT } from '../lib/newsAnalysisConstants';
import { newsCacheTag } from '../lib/newsCacheTag';
import { NEWS_ANALYSIS_LOOKBACK_MS } from '../lib/newsLookback';
import { selectUnanalyzed } from '../lib/selectUnanalyzed';
import { withNewsCardAnalysisLock } from './newsCardAnalysisLock';

/**
 * 적재를 돌리되 FMP 장애·402 같은 소스 실패는 삼키고 `null`을 돌려준다(fail-open) —
 * DB에 이미 있는 뉴스로 분석을 이어 가기 위해서다.
 *
 * DB 광역 장애(과반 upsert 실패, {@link NewsIngestWriteError})는 삼키지 않고 올려보낸다.
 * 삼키면 비어 있는 DB를 그대로 분석해 빈약한 스냅샷을 generatedAt=now로 굳혀 다음 거래일
 * 경계까지 재시도조차 안 된다. 위로 던지면 배치의 유닛 단위 catch가 스냅샷을 쓰지 않고
 * 다음 tick이 재시도한다.
 *
 * lookback을 분석 창(30일)으로 좁힌다: 사람 방문 경로는 뉴스 **목록**(180일)을 채워야
 * 하지만 cron은 바로 아래에서 30일치만 읽는다. 180일치를 upsert하면 매일 밤 295심볼에
 * 대해 읽지도 않을 기사를 Neon에 쓰게 되고, 그 왕복이 배치 데드라인을 갉아먹는다.
 */
async function ingestFailOpen(
    symbol: string,
    repo: DrizzleNewsRepository,
    profileId: MarketProfileId
): Promise<NewsIngestResult | null> {
    return ingestNewsForSymbol(
        symbol,
        repo,
        NEWS_ANALYSIS_LOOKBACK_MS,
        profileId
    ).catch((err: unknown) => {
        if (err instanceof NewsIngestWriteError) throw err;
        console.error(`[prewarmNews] ingest failed for ${symbol}:`, err);
        return null;
    });
}

/**
 * 이번 tick에 보강할 후보를 보강하고, 보강했으면 `true`(다시 읽어야 함)를 돌려준다.
 *
 * 카드 보강(번역 + 라벨링)을 건너뛰면 분석은 항상 실패한다 — `buildAnalysisNewsItems`가
 * `isEnrichedRow`로 미보강 행을 전부 걸러내고, core의 `runNewsAnalysis`는 빈 입력을 보고
 * `{status:'error', code:'no_news'}`를 돌려주므로 `news`·`overall` 두 탭 스냅샷이
 * 생성되지 않는다. 방문자 경로에만 보강이 있으면 사람이 찾지 않는 종목은 영원히
 * 보강되지 않고, 스냅샷이 없어 페이지가 얇아 유입이 생기지 않는 루프에 갇힌다
 * (프로덕션 실측: 국내 20종목 전부 보강 0건 / AAPL 288건).
 *
 * 상한(`PREWARM_NEWS_CARD_LIMIT`)을 두는 이유와 숫자 근거는 그 상수의 주석에 있다 —
 * 백로그가 큰 종목일수록 유닛 타임아웃에 걸리는데, 그게 바로 이 보강이 겨냥한 종목들이다.
 *
 * 후보는 `ingested.fresh`에서만 뽑는다. 적재가 실패한 밤(`null`)에는 새로 확인된 기사가
 * 없어 DB의 어떤 행이 유효한 후보인지 판단할 근거가 없으므로 보강도 건너뛴다.
 * `fetchNewsForPeriod`는 델타가 아니라 30일 창 전체를 매번 돌려주므로 다음에 적재가
 * 성공하면 남은 미보강 행이 그대로 후보로 다시 잡힌다. 후보 좁히기(미보강 ∩ DB 실재)는
 * `selectUnanalyzed`가 맡는다 — 챗 경로(`ensureSymbolNewsFresh`)와 같은 판단이다.
 *
 * 방문자 경로가 같은 심볼을 분석 중이면 건너뛴다(`withNewsCardAnalysisLock`) — 겹치면 같은
 * 기사에 LLM을 두 번 태운다. 그 tick은 이미 보강된 행으로 진행하고 남은 기사는 다음 tick이
 * 이어받는다.
 */
async function enrichIngestedBacklog(
    symbol: string,
    repo: DrizzleNewsRepository,
    ingested: NewsIngestResult | null,
    rows: readonly NewsRow[]
): Promise<boolean> {
    const unanalyzed =
        ingested === null ? [] : selectUnanalyzed(ingested.fresh, rows);
    if (unanalyzed.length === 0) return false;
    return withNewsCardAnalysisLock(symbol, () =>
        analyzeNewsCards(unanalyzed, repo, {
            limit: PREWARM_NEWS_CARD_LIMIT,
            logLabel: 'prewarmNews',
        })
    );
}

/**
 * SEO pre-warm 전용 news submit. `submitNewsAnalysisAction`의 기본 경로(봇/사람 구분
 * 없음)를 요청 컨텍스트 없이 재현한다(캐시 키 5축 정합: model default / tier free /
 * reasoning false / 동일 fingerprint). 차이는 force 뿐 — `skipEnqueueIfMiss`는 액션에서도
 * 항상 `false`다.
 *
 * modelId는 익명/free 방문자가 실제로 보내는 기본값(`DEEPSEEK_V4_1_FLASH_MODEL` —
 * `SymbolModelContext`의 `useSelectedModel` 기본값과 동일)을 명시 전달한다. core의 news
 * submit 옵션은 `modelId`를 그대로 캐시 키에 사용하고 내부 fallback이 없으므로, 생략하면
 * 익명 writer가 쓰는 키와 어긋난다.
 *
 * DB I/O(DrizzleNewsRepository)·cross-entity 조합(earnings-report)·외부 core submit
 * 호출을 하는 orchestration이라 `lib/`(순수 함수 전용, src/entities/CLAUDE.md#EN-1)가
 * 아니라 `server/`에 둔다.
 *
 * ⚠️ 요청 헤더 읽기·세션 사용자 조회·봇 판별·쿠키 접근 금지 — cron의 `after()`
 * 컨텍스트에서 실행되며 React 요청 스코프가 없다.
 *
 * **ingest-before-read (2026-07-26 측정)** — `listBySymbol`을 읽기 전에
 * `ingestNewsForSymbol`로 뉴스를 먼저 채운다. 사람이 news 탭을 방문할 때만 news 테이블이
 * 채워지면, pre-warm cron은 그 방문을 만들지 않으므로 최근 30일(`NEWS_ANALYSIS_LOOKBACK_MS`)
 * 안에 아무도 안 본 심볼은 `listBySymbol`이 항상 빈 배열을 반환해 news 분석이 영구
 * 실패하고, `overall`도 news에 의존하므로 함께 실패한다. 실측: 하베스트된 221개 심볼 중
 * 44개(20%)가 이 창에 걸렸고, 저-트래픽 크립토 알트코인이 가장 심했다(처리된 크립토 ~15개
 * 중 11개가 적용 가능한 3개 탭 중 technical만 확보). cron은 사람 방문에 기대지 않고 스스로
 * 완결돼야 한다. 신규 FMP 호출 비용은 방문마다 심볼당 1회 — 유니버스 295개, FMP 한도
 * 분당 300req, 배치는 5분 tick당 12심볼(2026-10-02 이전 6)만 처리하므로 무시 가능하다.
 *
 * @returns core 결과. 적재가 실패한 밤(fail-open)이면 `newsFetchFailed: true`를 더 싣는다.
 *   적재가 실패해 DB가 비어 있으면 core는 "뉴스가 없다"(`no_news`)와 "뉴스를 못 가져왔다"를
 *   똑같이 보는데, 호출부(`resolveHarvest`)가 둘에 서로 다른 backoff를 매기므로 구분 가능한
 *   유일한 지점인 여기서 신호를 붙인다 — 없으면 FMP 장애 중 신규·저커버리지 심볼이 30분이
 *   아니라 24시간 묶인다.
 */
export async function prewarmNews(
    symbol: string,
    companyName: string,
    force: boolean
): Promise<RunNewsAnalysisResult & { newsFetchFailed?: true }> {
    // resolveMarketProfile()은 내부적으로 getAssetInfo()를 호출한다. 프로필을 여기서 한 번만
    // resolve하고 ingestNewsForSymbol에 넘겨 심볼당 밤마다 getAssetInfo Redis 왕복이
    // 중복되는 것을 막는다.
    const profileId = await resolveMarketProfile(symbol);
    const descriptor = getDescriptor(profileId);
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);

    const ingested = await ingestFailOpen(symbol, repo, profileId);

    // 새로 적재된 기사가 있으면 news 목록 캐시를 무효화한다. 없으면 cron이 DB를 채워도
    // `getNewsList`의 staticSymbolCache(태그 `news:{SYMBOL}`, 12h)가 빈 목록을 계속
    // 서빙해 적재 성과가 최대 12시간 노출되지 않는다. `revalidateTag('seo-snapshot:…')`는
    // 다른 태그이고 전 탭 수렴 시에만 발화하므로 이 경로를 대신하지 못한다.
    if (ingested !== null && countChangedRows(ingested) > 0) {
        revalidateTag(newsCacheTag(symbol), 'max');
    }

    const [initialRows, next, macroCalendar] = await Promise.all([
        repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS),
        getNextEarningsReport(symbol, db),
        loadNewsMacroCalendar(),
    ]);

    // 방금 채운 보강 결과를 반영해 다시 읽는다 — 이 재조회가 없으면 이번 tick은 보강 비용만
    // 쓰고 여전히 빈 입력으로 분석을 부른다.
    const enriched = await enrichIngestedBacklog(
        symbol,
        repo,
        ingested,
        initialRows
    );
    const rows = enriched
        ? await repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS)
        : initialRows;

    const enrichedNews: ReadonlyArray<EnrichedNewsItem> =
        buildAnalysisNewsItems(rows);

    const result = await runNewsAnalysis({
        symbol,
        companyName,
        modelId: DEEPSEEK_V4_1_FLASH_MODEL,
        news: enrichedNews,
        upcomingCalendar: next !== null ? [next] : [],
        // 방문자 경로와 같은 헬퍼 — 캐시 키 일치 불변식.
        macroCalendar,
        tier: 'free',
        reasoning: false,
        providerFallback: PREWARM_PROVIDER_FALLBACK,
        skipEnqueueIfMiss: false,
        assetClass: descriptor.assetClass,
        // 방문자 경로(submitNewsAnalysisAction)와 같은 값을 넘겨야 prewarm이 채운
        // 캐시의 산출 텍스트가 갈리지 않는다.
        currency: descriptor.priceFormat.currency,
        ...(force ? { force: true } : {}),
    });
    return ingested === null ? { ...result, newsFetchFailed: true } : result;
}
