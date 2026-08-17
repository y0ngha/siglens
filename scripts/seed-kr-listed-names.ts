import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import {
    fetchKrxListedItems,
    hasDataGoKrCredentials,
    type KrxListedItem,
} from '../src/shared/api/dataGoKr/krxListedInfoClient';

/**
 * `korean_tickers` 테이블 정의 — `src/shared/db/schema.ts`의 동명 테이블과 **같은 컬럼**이다.
 *
 * 앱 스키마를 import하지 않고 여기서 다시 선언하는 이유: `schema.ts`가 최상단에
 * `import 'server-only'`를 선언하는데, 그 모듈은 Next.js 번들러가 제공하는 가상
 * 패키지라 `node_modules`에 실체가 없다. 시드는 Next 런타임 밖에서 `tsx`로 도는
 * 순수 Node 스크립트여서 그 import가 `MODULE_NOT_FOUND`로 즉시 죽는다
 * (같은 이유로 기존 `db:seed:crypto`도 이 워크트리에서 실행되지 않는다).
 *
 * 중복이 생기는 대신 시드가 앱의 server-only 경계를 침범하지 않는다. 컬럼이 바뀌면
 * 양쪽을 함께 고쳐야 하므로, 이 주석과 `schema.ts`의 정의를 서로의 단서로 남긴다.
 */
const koreanTickers = pgTable('korean_tickers', {
    // 길이는 schema.ts의 SYMBOL_MAX_LENGTH / EXCHANGE_MAX_LENGTH(각 32)와 일치해야 한다.
    symbol: varchar('symbol', { length: 32 }).primaryKey(),
    koreanName: text('korean_name').notNull(),
    name: text('name').notNull(),
    exchange: varchar('exchange', { length: 32 }).notNull(),
    exchangeFullName: text('exchange_full_name').notNull(),
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
 * 이 스크립트가 전 종목을 미리 채워 그 문제를 없앤다.
 *
 * 실행:
 *   yarn db:seed:kr-names
 *
 * 필요 환경변수: `DATA_GO_KR_SERVICE_KEY`, `DATABASE_URL`(또는 `DIRECT_DATABASE_URL`).
 * 갱신 주기: API가 일 1회(기준일 다음 영업일 13시 이후) 갱신되므로 하루 1회면 충분하다.
 */

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL env var required');
}

const UPSERT_BATCH_SIZE = 500;

/**
 * 시장 구분 → canonical 심볼 접미사.
 *
 * KONEX가 `null`인 것은 의도적이다 — yahoo에 KONEX 시세가 없음을 실측으로 확인했다
 * (2026-08-16: `.KN` 심볼 검색 0건). 시드에 넣으면 검색 결과에는 뜨는데 클릭하면
 * 404가 나는 죽은 링크가 된다.
 */
const MARKET_SUFFIX: Record<KrxListedItem['market'], string | null> = {
    KOSPI: '.KS',
    KOSDAQ: '.KQ',
    KONEX: null,
};

const EXCHANGE_FULL_NAME: Record<string, string> = {
    KOSPI: 'Korea Exchange (KOSPI)',
    KOSDAQ: 'KOSDAQ',
};

interface KoreanTickerRow {
    symbol: string;
    koreanName: string;
    name: string;
    exchange: string;
    exchangeFullName: string;
}

function toRow(item: KrxListedItem): KoreanTickerRow[] {
    const suffix = MARKET_SUFFIX[item.market];
    if (suffix === null) return [];

    return [
        {
            symbol: `${item.shortCode}${suffix}`,
            koreanName: item.koreanName,
            // 이 소스는 영문명을 주지 않는다. `name`은 NOT NULL이라 한글명을 넣어 둔다 —
            // 영문명은 종목 방문 시 `getAssetInfo`가 yahoo quote에서 따로 채운다
            // (korean_tickers.name은 표시명 폴백일 뿐 authoritative가 아니다).
            name: item.koreanName,
            exchange: item.market,
            exchangeFullName: EXCHANGE_FULL_NAME[item.market] ?? item.market,
        },
    ];
}

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

    // 같은 단축코드가 여러 행으로 오는 경우(기준일 중복 등)를 접는다 —
    // ON CONFLICT DO UPDATE는 한 문장에서 같은 행을 두 번 건드릴 수 없다.
    const rows = Array.from(
        new Map(items.flatMap(toRow).map(r => [r.symbol, r])).values()
    );
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

    console.log('korean_tickers KR seed complete');
    await client.end();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
