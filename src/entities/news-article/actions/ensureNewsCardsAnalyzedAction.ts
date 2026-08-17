'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import {
    ingestNewsForSymbol,
    NewsIngestWriteError,
} from '../lib/ingestNewsForSymbol';
import { NEWS_CARD_ANALYSIS_PARALLEL_LIMIT } from '../lib/newsAnalysisConstants';
import { NEWS_LOOKBACK_MS } from '../lib/newsLookback';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import { isRecentlyFetched } from '../lib/newsRefreshFlag';
import { revalidateTag } from 'next/cache';
import { isE2E } from '@/shared/api/e2eEnv';
import { runNewsCardAnalysis, type NewsItem } from '@y0ngha/siglens-core';

/**
 * Run card analysis for a single item and persist the result to DB.
 *
 * Caller guarantees that `item` has not been analyzed yet (analyzedAt === null).
 * `runNewsCardAnalysis` returns `{ status: 'done', result }` directly — no polling.
 *
 * 추론 on/off는 여기서 정하지 않는다 — `runNewsCardAnalysis`가 use-case 정책으로
 * `reasoning: false`를 고정한다(번역 + 라벨링은 결정적 변환). 구
 * `thinkingBudget: 0`은 Gemini 전용 인자였고 DeepSeek 분기에서는 무시되므로
 * 제거했다.
 */
async function analyzeAndPersist(
    item: NewsItem,
    repo: DrizzleNewsRepository
): Promise<void> {
    const analyzed = await runNewsCardAnalysis({ item });

    // titleKo와 summaryKo가 **둘 다** 비면 core normalizer의 crash-safe fallback을
    // 그대로 받은 것이다 — `normalizeNewsCardAnalysis`는 응답이 스키마와 어긋나면
    // `asObject(parsed) ?? {}`로 전 필드를 기본값(문자열 '', sentiment 'neutral',
    // category 'other')으로 떨어뜨린다. 그대로 저장하면 `analyzedAt`이 세팅되어
    // 이 기사는 두 번 다시 분석되지 않고 그 기본값이 영구 고착한다 — DB를 손으로
    // 되돌리기 전까지 복구 불가. 경제 이벤트·지표 번역 경로와 같은 skip 정책이다
    // (`ensureEconomicEventsAnalyzedAction`).
    //
    // DeepSeek 어댑터는 `responseSchema`를 무시하고 `json_object`만 걸어(JSON
    // 유효성만 보장, 필드·enum은 미보장) 이 경로가 실제로 열려 있다.
    //
    // 조건을 "둘 다 빈 경우"로 좁힌 이유는 재시도 비용이다. 이 경로에는
    // TTL 게이트가 없다(`isRecentlyFetched`는 봇 분기 전용 — 사람은 항상 fresh)
    // 그래서 `analyzedAt`이 null로 남은 기사는 FMP lookback(180일) 동안 방문마다
    // 다시 분석된다. titleKo가 채워진 응답은 모델이 실제로 만들어낸 결과이지
    // fallback이 아니므로 저장하는 편이 맞고, 그만큼 재시도 표면이 좁아진다.
    // 남은 표면(완전 fallback)은 응답 자체가 비결정적이라 재시도로 대개 회복된다.
    const { titleKo, summaryKo } = analyzed.result;
    if (titleKo.trim() === '' && summaryKo.trim() === '') {
        console.warn(
            `[ensureNewsCardsAnalyzedAction] empty card analysis — skipping persist for ${item.id}`
        );
        return;
    }

    await repo.attachAnalysis(item.id, analyzed.result, new Date());
}

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
    // 봇 경로만 가드: 최근 TTL 내 fetch했으면 FMP fetch + N건 DB upsert를 스킵한다.
    // 봇은 DB의 기존 뉴스를 그대로 읽으므로 SEO 무해. 사람 경로는 항상 fresh.
    if (options?.skipAnalysis && (await isRecentlyFetched(symbol))) {
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
    const rows = await repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
    const analyzedIds = new Set(
        rows.filter(r => r.analyzedAt !== null).map(r => r.id)
    );
    const unanalyzed = fresh.filter(item => !analyzedIds.has(item.id));

    if (unanalyzed.length === 0) return;

    // `runNewsCardAnalysis`는 블로킹 LLM 왕복이다(worker 제거 이후). 무제한 병렬
    // 실행은 2-vCPU 서버에서 커넥션 풀 고갈 / 메모리 압박을 유발하므로
    // NEWS_CARD_ANALYSIS_PARALLEL_LIMIT개씩 청크 단위로 실행한다.
    const analyzeSettled = await withConcurrencyLimit(
        unanalyzed,
        NEWS_CARD_ANALYSIS_PARALLEL_LIMIT,
        item => analyzeAndPersist(item, repo)
    );
    const analyzeFailures = analyzeSettled.filter(r => r.status === 'rejected');
    if (analyzeFailures.length > 0) {
        console.error(
            `[ensureNewsCardsAnalyzedAction] ${analyzeFailures.length}/${unanalyzed.length} analyzeAndPersist failed`,
            analyzeFailures.map(f =>
                f.status === 'rejected' ? f.reason : null
            )
        );
    }
}
