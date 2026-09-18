/**
 * `seo_analysis_snapshots.first_generated_at` 1회 백필.
 *
 * 돌리기 전에 `drizzle/0036_snapshot_first_generated_at.sql`이 적용돼 있어야 한다.
 *
 *   yarn db:backfill:snapshot-first-gen            # dry-run (기본값)
 *   yarn db:backfill:snapshot-first-gen --apply    # 실제 쓰기
 *
 * **왜 필요한가**: `generated_at`은 프리웜마다 덮이는 "최신 생성"이라 발행일이
 * 아니다. 뉴스 탭의 `Article` 구조화데이터가 `datePublished`를 필요로 하는데,
 * 최신 생성 시각을 발행일이라 주장하면 전 종목이 매일 새로 발행된다는 거짓
 * 신선도 신호가 된다. 새로 굽히는 행은 upsert가 INSERT 시점에 채우므로, 이
 * 스크립트는 **컬럼 도입 전에 이미 있던 행만** 대상으로 한다.
 *
 * **소스 선택** (2026-09-18 운영 DB 실측):
 * - `tab='news'` → 심볼별 `min(news.fetched_at)`. 그 종목의 뉴스를 처음 수집한
 *   시각이고, 뉴스 탭 본문은 그 수집분을 요약한 것이다. 스냅샷 389행 중 388행이
 *   커버된다. 심볼마다 값이 달라 "전 종목 같은 날짜" 문제가 없다.
 * - `tab='technical'` → `(symbol, tab)`별 `min(analysis_history.created_at)`.
 *   분석 1건당 1행이라 최초 생성 시각이 그대로 남아 있다(2026-09-05 이후 행만
 *   존재하므로 그보다 오래된 스냅샷은 커버되지 않는다).
 * - 나머지 탭(`fundamental`·`financials`·`overall`·`congress`·`options`) → **건드리지
 *   않는다.** 진실한 소스가 없고, 소비하는 마크업도 없다. 모르는 값을 지어내는 대신
 *   `NULL`로 남기면 소비자가 발행일 주장을 생략하고, 다음 프리웜이 그 행을 다시 구울
 *   때 정확한 값이 들어온다.
 *
 * **멱등하다** — `WHERE first_generated_at IS NULL`만 건드린다. 그래서 운영 절차는
 * 2패스다: ① 마이그레이션 적용 후 1회 → ② 코드 배포 → ③ 다시 1회. ②~③ 사이(또는
 * ①~② 사이)에 프리웜이 새로 넣은 행은 아직 컬럼을 모르는 코드가 만든 것이라
 * `NULL`인데, 3단계가 그 잔여분을 줍는다. 이미 채워진 행은 두 번째 실행에서
 * 제외되므로 값이 흔들리지 않는다.
 *
 * `src/shared/db/*`를 import하지 않는 이유는 `backfillContentLocale.ts`와 같다 —
 * 그 모듈들이 최상단에 `import 'server-only'`를 선언하고, Next 런타임 밖에서 도는
 * `tsx` 프로세스에서는 그 가상 패키지가 없어 즉시 죽는다.
 */
import postgres from 'postgres';
import { assertRemoteWriteAllowed, readDatabaseUrl } from './lib/dbTarget';

/** 탭 이름은 `SEO_SNAPSHOT_TABS`(src/entities/seo-snapshot/model.ts)와 같은 문자열이다. */
const NEWS_TAB = 'news';
const TECHNICAL_TAB = 'technical';

interface Plan {
    /** 로그에 찍히는 이름. */
    readonly label: string;
    /** 채울 대상 탭. */
    readonly tab: string;
    /**
     * `(symbol, tab)` → 최초 시각을 주는 SELECT. `first_at`이 `NULL`인 조합은
     * UPDATE에서 자동으로 빠진다(아래 `AND src.first_at IS NOT NULL`).
     */
    readonly sourceSql: (sql: postgres.Sql) => postgres.PendingQuery<never[]>;
}

const PLANS: readonly Plan[] = [
    {
        label: 'news ← min(news.fetched_at)',
        tab: NEWS_TAB,
        sourceSql: sql => sql`
            SELECT symbol, MIN(fetched_at) AS first_at
            FROM news
            GROUP BY symbol
        `,
    },
    {
        label: 'technical ← min(analysis_history.created_at)',
        tab: TECHNICAL_TAB,
        sourceSql: sql => sql`
            SELECT symbol, MIN(created_at) AS first_at
            FROM analysis_history
            WHERE tab = ${TECHNICAL_TAB}
            GROUP BY symbol
        `,
    },
];

async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    const { databaseUrl, target } = readDatabaseUrl();
    if (apply) {
        assertRemoteWriteAllowed(target, 'backfill first_generated_at');
    }

    const sql = postgres(databaseUrl, { max: 1 });
    try {
        const [{ pending }] = await sql<{ pending: number }[]>`
            SELECT COUNT(*)::int AS pending
            FROM seo_analysis_snapshots
            WHERE first_generated_at IS NULL
        `;
        console.log(`[backfill] first_generated_at 미설정 행: ${pending}`);

        for (const plan of PLANS) {
            // 대상 건수를 **먼저** 센다 — dry-run이 "몇 행이 바뀔지"를 실제 조인으로
            // 보여줘야 의미가 있다. 소스에 없는 심볼은 여기서 이미 빠진다.
            const [{ affected }] = await sql<{ affected: number }[]>`
                SELECT COUNT(*)::int AS affected
                FROM seo_analysis_snapshots s
                JOIN (${plan.sourceSql(sql)}) src ON src.symbol = s.symbol
                WHERE s.tab = ${plan.tab}
                  AND s.first_generated_at IS NULL
                  AND src.first_at IS NOT NULL
            `;
            console.log(`[backfill] ${plan.label}: 대상 ${affected}행`);
            if (!apply || affected === 0) continue;

            const updated = await sql`
                UPDATE seo_analysis_snapshots s
                SET first_generated_at = src.first_at
                FROM (${plan.sourceSql(sql)}) src
                WHERE src.symbol = s.symbol
                  AND s.tab = ${plan.tab}
                  AND s.first_generated_at IS NULL
                  AND src.first_at IS NOT NULL
            `;
            console.log(`[backfill] ${plan.label}: ${updated.count}행 갱신`);
        }

        const [{ remaining }] = await sql<{ remaining: number }[]>`
            SELECT COUNT(*)::int AS remaining
            FROM seo_analysis_snapshots
            WHERE first_generated_at IS NULL
        `;
        console.log(
            `[backfill] 남은 NULL: ${remaining}` +
                (apply
                    ? ' (소스가 없는 탭은 의도적으로 NULL로 남긴다)'
                    : ' — dry-run이라 아무것도 쓰지 않았다. --apply로 실행할 것.')
        );
    } finally {
        await sql.end();
    }
}

void main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
