import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, inArray, isNull, sql } from 'drizzle-orm';
import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import {
    fetchKrxListedItems,
    hasDataGoKrCredentials,
} from '../src/shared/api/dataGoKr/krxListedInfoClient';
import { toKoreanTickerRows } from '../src/shared/api/dataGoKr/toKoreanTickerRows';
import {
    formatCandidates,
    planKrTickerReconcile,
} from '../src/shared/lib/krTickerReconcile';
import { KOREAN_TICKERS_CACHE_KEY } from '../src/entities/ticker/lib/cacheKeys';
import { createCacheProvider } from '@y0ngha/siglens-core';

/**
 * `korean_tickers` 테이블 정의 — `src/shared/db/schema.ts`의 동명 테이블과 **같은 컬럼**이다.
 *
 * 앱 스키마를 import하지 않고 여기서 다시 선언하는 이유: `schema.ts`가 최상단에
 * `import 'server-only'`를 선언하는데, 그 모듈은 Next.js 번들러가 제공하는 가상
 * 패키지라 `node_modules`에 실체가 없다. 시드는 Next 런타임 밖에서 `tsx`로 도는
 * 순수 Node 스크립트여서 그 import가 `MODULE_NOT_FOUND`로 즉시 죽는다.
 *
 * 중복이 생기는 대신 시드가 앱의 server-only 경계를 침범하지 않는다. 컬럼이 바뀌면
 * 양쪽을 함께 고쳐야 하므로, 이 주석과 `schema.ts`의 정의를 서로의 단서로 남긴다.
 *
 * **판단 로직은 중복되지 않는다** — 무엇을 상폐로 볼지는 `planKrTickerReconcile`,
 * 응답을 행으로 바꾸는 매핑은 `toKoreanTickerRows`가 갖고 있고 크론 라우트
 * (`syncKrListedTickers`)도 같은 두 모듈을 쓴다. 여기 남는 중복은 테이블 선언과
 * SQL 실행뿐이다.
 */
const koreanTickers = pgTable('korean_tickers', {
    // 길이는 schema.ts의 SYMBOL_MAX_LENGTH / EXCHANGE_MAX_LENGTH(각 32)와 일치해야 한다.
    symbol: varchar('symbol', { length: 32 }).primaryKey(),
    koreanName: text('korean_name').notNull(),
    name: text('name').notNull(),
    exchange: varchar('exchange', { length: 32 }).notNull(),
    exchangeFullName: text('exchange_full_name').notNull(),
    delistedAt: timestamp('delisted_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
});

/**
 * 공공데이터포털 KRX상장종목정보 → `korean_tickers` 시드.
 *
 * **왜 필요한가**: yahoo `search`가 한글 질의를 거부하므로("BadRequestError: Invalid
 * Search Query"), 한국 종목의 한글명 검색은 자체 마스터 없이는 성립하지 않는다.
 * 기존 lazy 번역(`translateCompanyNames`)은 **누군가 그 종목을 이미 방문했을 때만**
 * 행을 만들어서, 첫 사용자에게는 검색 결과가 비어 있는 닭-달걀 문제가 있었다.
 *
 * 상시 갱신은 크론(`PATCH /api/cron/kr-tickers`, 일 1회)이 담당한다. 이 스크립트는
 * 앱을 띄우지 않고 손으로 돌리는 부트스트랩·복구 경로이며, 같은 판정 로직을 공유하므로
 * 어느 쪽으로 돌려도 결과가 같다.
 *
 * 실행:
 *   yarn db:seed:kr-names
 *
 * 필요 환경변수: `DATA_GO_KR_SERVICE_KEY`, `DATABASE_URL`(또는 `DIRECT_DATABASE_URL`).
 */

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL env var required');
}

const UPSERT_BATCH_SIZE = 500;

/**
 * 대량 상폐 수동 승인 플래그.
 *
 * 하루 25종목 넘게 사라지면 가드가 상폐 처리를 통째로 멈춘다. 진짜 대량 정리였다면
 * 크론은 다음 날도 같은 후보로 다시 걸리므로 스스로 수렴하지 못한다 — 그건 의도된
 * 정지다. 사람이 로그의 후보 목록을 확인한 뒤 이 플래그로 한 번 통과시킨다.
 * 상수를 고쳐 재배포할 필요가 없고, 승인이 그때 한 번으로 끝난다는 점이 중요하다.
 */
const FORCE_DELIST = process.argv.includes('--force-delist');

async function main() {
    if (!hasDataGoKrCredentials()) {
        throw new Error(
            'DATA_GO_KR_SERVICE_KEY env var required — https://www.data.go.kr/data/15094775/openapi.do 에서 활용신청'
        );
    }

    const items = await fetchKrxListedItems();
    console.log(`Fetched ${items.length} listed items from data.go.kr`);

    const byMarket = items.reduce<Record<string, number>>((acc, i) => {
        acc[i.market] = (acc[i.market] ?? 0) + 1;
        return acc;
    }, {});
    console.log('By market:', byMarket);

    const rows = toKoreanTickerRows(items);
    const skipped = items.length - rows.length;
    console.log(
        `Upserting ${rows.length} rows (skipped ${skipped}: KONEX + duplicates)`
    );

    if (rows.length === 0) {
        console.warn('No rows to write — aborting without touching the table');
        return;
    }

    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzle(client);

    try {
        const existing = await db
            .select({
                symbol: koreanTickers.symbol,
                delistedAt: koreanTickers.delistedAt,
            })
            .from(koreanTickers);

        const plan = planKrTickerReconcile(
            rows.map(row => row.symbol),
            existing,
            { allowLargeDelist: FORCE_DELIST }
        );

        let written = 0;
        for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
            const chunk = rows.slice(i, i + UPSERT_BATCH_SIZE);
            await db
                .insert(koreanTickers)
                .values(chunk)
                .onConflictDoUpdate({
                    target: koreanTickers.symbol,
                    set: {
                        koreanName: sql`excluded.korean_name`,
                        exchange: sql`excluded.exchange`,
                        exchangeFullName: sql`excluded.exchange_full_name`,
                        // `name`은 덮어쓰지 않는다 — 방문 시 yahoo가 채운 영문명이
                        // 한글명으로 되돌아가면 표시가 퇴행한다.
                        // Drizzle은 conflict-update에서 $onUpdateFn을 돌리지 않으므로
                        // updatedAt을 명시해야 stale해지지 않는다.
                        updatedAt: sql`now()`,
                    },
                });
            written += chunk.length;
            console.log(`Upserted ${written}/${rows.length}`);
        }

        if (plan.relist.length > 0) {
            await db
                .update(koreanTickers)
                .set({ delistedAt: null })
                .where(inArray(koreanTickers.symbol, [...plan.relist]));
            console.log(`Relisted ${plan.relist.length}`);
        }

        if (plan.guardTrip !== null) {
            console.error(
                `Delist skipped — ${plan.guardTrip}. Upserts still applied.`
            );
            // 후보를 찍어 둬야 사람이 --force-delist를 줄지 판단할 수 있다.
            console.error(
                `Delist candidates: ${formatCandidates(plan.delistCandidates)}`
            );
        } else if (plan.delist.length > 0) {
            // 이미 표시된 행은 건드리지 않는다 — 상폐 시각이 매 실행마다 밀리면
            // "언제부터 상폐였나"를 잃는다.
            await db
                .update(koreanTickers)
                .set({ delistedAt: sql`now()` })
                .where(
                    and(
                        inArray(koreanTickers.symbol, [...plan.delist]),
                        isNull(koreanTickers.delistedAt)
                    )
                );
            console.log(`Delisted ${plan.delist.length}`);
        }

        if (plan.delistedPopular.length > 0) {
            console.error(
                `Delisted POPULAR_TICKERS entries — remove them from popular-tickers.ts or sitemap will serve 404s: ${plan.delistedPopular.join(', ')}`
            );
        }

        // 검색은 `korean:tickers` 캐시에 담긴 전체 목록에 substring 필터를 돌린다.
        // TTL이 1년이라 사실상 영구다 — 비우지 않으면 방금 표시한 상폐 종목이 계속
        // 자동완성에 뜬다. 크론(`syncKrListedTickers`)이 같은 일을 하므로, 이 스크립트만
        // 빠지면 "복구용 경로가 복구를 완성하지 못하는" 상태가 된다.
        await invalidateKoreanTickerCache();

        console.log('korean_tickers KR seed complete');
    } finally {
        await client.end();
    }
}

/**
 * `koreanNameStore`를 그대로 쓰지 못하는 이유는 이 파일 상단 주석과 같다 — 그 모듈은
 * `api.ts`를 거쳐 `schema.ts`의 `server-only`에 닿는다. `cacheKeys`와 core의
 * `createCacheProvider`는 그 체인 밖이라 여기서 직접 쓸 수 있다.
 */
async function invalidateKoreanTickerCache(): Promise<void> {
    try {
        const cache = createCacheProvider();
        if (!cache) return;
        await cache.delete(KOREAN_TICKERS_CACHE_KEY);
        console.log('korean:tickers cache invalidated');
    } catch (e) {
        // 캐시가 없거나 못 지워도 DB 상태는 이미 옳다. 다음 크론이 다시 비운다.
        console.warn('korean:tickers cache invalidation failed', e);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
