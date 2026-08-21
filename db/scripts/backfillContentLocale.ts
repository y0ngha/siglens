/**
 * `content_translations` 백필 — 기존 한국어 컬럼을 사이드카의 `ko` 행으로 옮긴다.
 *
 * 배포 순서(설계 §2.5.3)의 **3단계**다. 돌리기 전에
 * `drizzle/0029_content_locale.sql`이 적용돼 있어야 한다.
 *
 *   yarn db:backfill:content-locale            # dry-run (기본값)
 *   yarn db:backfill:content-locale --apply    # 실제 쓰기
 *
 * **기본이 dry-run인 이유**: 이 스크립트는 수만 행을 INSERT한다. 실수로 프로덕션
 * DB에 대고 돌렸을 때 아무 일도 일어나지 않는 편이 낫다.
 *
 * **멱등하다** — `ON CONFLICT DO NOTHING`이라 여러 번 돌려도 안전하고, 이미
 * 번역이 들어간 로케일 행을 덮어쓰지 않는다. 백필은 **ko 행만** 만든다: 다른
 * 로케일은 번역 파이프라인(§5)이 채운다.
 *
 * **`src/shared/db/*`를 import하지 않는 이유**: `client.ts`·`schema.ts`가 최상단에
 * `import 'server-only'`를 선언하는데, 그 모듈은 Next.js 번들러가 제공하는 가상
 * 패키지라 `node_modules`에 실체가 없다. 이 스크립트는 Next 런타임 밖에서 `tsx`로
 * 도는 순수 Node 프로세스여서 그 import가 `MODULE_NOT_FOUND`로 즉시 죽는다
 * (`scripts/seed-kr-listed-names.ts`가 같은 이유로 같은 형태다).
 *
 * ⚠️ 첫 판은 정확히 그 import 때문에 **실행 자체가 불가능**했다. 소스를 grep하는
 * 테스트는 통과했고, 로컬 Postgres에 실제로 돌려 보고서야 드러났다 — 이 파일의
 * 회귀 가드가 `--help` 실행까지 하는 이유다.
 *
 * `contentTranslationFields.ts`·`locales.ts`는 `server-only`가 없는 순수 상수
 * 모듈이라 그대로 import한다. 필드명을 여기서 다시 적으면 읽기 경로가 쓰는 이름과
 * 어긋나도 아무도 모른다(폴백이 걸려 화면은 멀쩡하다).
 */
import postgres from 'postgres';
import { assertRemoteWriteAllowed, readDatabaseUrl } from './lib/dbTarget';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
    TRANSLATION_SOURCE,
    type TranslatableEntity,
} from '../../src/shared/db/contentTranslationFields';
import { DEFAULT_LOCALE } from '../../src/shared/i18n/locales';
import { DEFAULT_SINCE, parseSince } from './lib/backfillWindow';

/** 원본 테이블에서 `(id, field, value)`를 뽑는 SELECT 한 벌. */
interface BackfillSource {
    readonly entity: TranslatableEntity;
    /** 진행 로그에 찍히는 이름. */
    readonly label: string;
    /**
     * `id`·`field`·`value` 세 컬럼을 돌려주는 원시 SQL.
     *
     * Drizzle 스키마에 묶지 않는 이유: 이 스크립트는 마이그레이션 직후 한 번 도는
     * 일회성 작업이고, 원본 컬럼(`title_ko` 등)은 백필이 끝나면 사라질 수도 있다.
     * 스키마에 묶어 두면 그 컬럼을 지우는 순간 아무도 쓰지 않는 이 파일이 컴파일
     * 에러를 낸다.
     */
    readonly sql: string;
    /**
     * `{WINDOW}` 자리에 끼울 시간 조건의 컬럼. 없으면 창을 적용하지 않는다
     * (약관·공지처럼 행이 몇 개뿐이거나 시간축이 없는 소스).
     */
    readonly timeColumn?: string;
}

const F = CONTENT_FIELD;

const SOURCES: readonly BackfillSource[] = [
    {
        entity: TRANSLATABLE_ENTITY.news,
        label: 'news',
        timeColumn: 'published_at',
        sql: `
            SELECT id, '${F.news.title}' AS field, title_ko AS value
              FROM news WHERE title_ko IS NOT NULL AND title_ko <> '' AND {WINDOW}
            UNION ALL
            SELECT id, '${F.news.summary}', summary_ko
              FROM news WHERE summary_ko IS NOT NULL AND summary_ko <> '' AND {WINDOW}
            UNION ALL
            SELECT id, '${F.news.body}', body_ko
              FROM news WHERE body_ko IS NOT NULL AND body_ko <> '' AND {WINDOW}
        `,
    },
    {
        entity: TRANSLATABLE_ENTITY.marketNews,
        label: 'market_news',
        timeColumn: 'published_at',
        sql: `
            SELECT id, '${F.marketNews.title}' AS field, title_ko AS value
              FROM market_news WHERE title_ko IS NOT NULL AND title_ko <> '' AND {WINDOW}
            UNION ALL
            SELECT id, '${F.marketNews.summary}', summary_ko
              FROM market_news WHERE summary_ko IS NOT NULL AND summary_ko <> '' AND {WINDOW}
            UNION ALL
            SELECT id, '${F.marketNews.body}', body_ko
              FROM market_news WHERE body_ko IS NOT NULL AND body_ko <> '' AND {WINDOW}
        `,
    },
    {
        entity: TRANSLATABLE_ENTITY.notice,
        label: 'notices',
        sql: `
            SELECT id::text AS id, '${F.notice.title}' AS field, title AS value FROM notices
            UNION ALL
            SELECT id::text AS id, '${F.notice.body}', body FROM notices
            UNION ALL
            SELECT id::text AS id, '${F.notice.linkLabel}', link_label
              FROM notices WHERE link_label IS NOT NULL AND link_label <> ''
        `,
    },
    {
        entity: TRANSLATABLE_ENTITY.terms,
        label: 'terms',
        sql: `SELECT id::text AS id, '${F.terms.body}' AS field, body AS value FROM terms`,
    },
    {
        entity: TRANSLATABLE_ENTITY.economicCalendar,
        label: 'economic_calendar',
        sql: `
            SELECT id, '${F.economicCalendar.summary}' AS field, summary_ko AS value
              FROM economic_calendar
             WHERE summary_ko IS NOT NULL AND summary_ko <> ''
            UNION ALL
            SELECT id, '${F.economicCalendar.interpretation}', interpretation_ko
              FROM economic_calendar
             WHERE interpretation_ko IS NOT NULL AND interpretation_ko <> ''
        `,
    },
    {
        entity: TRANSLATABLE_ENTITY.profileDescription,
        label: 'profile_description_translations',
        sql: `
            SELECT symbol AS id, '${F.profileDescription.description}' AS field,
                   description_ko AS value
              FROM profile_description_translations
             WHERE description_ko IS NOT NULL AND description_ko <> ''
        `,
    },
];

/** 한 번에 INSERT할 행 수. 드라이버 페이로드 한계를 넉넉히 밑돈다. */
const CHUNK_SIZE = 500;

interface BackfillRow {
    id: string;
    field: string;
    value: string;
}

export async function backfillContentLocale(
    sql: postgres.Sql,
    apply: boolean,
    since: string | null = DEFAULT_SINCE
): Promise<number> {
    let total = 0;

    for (const source of SOURCES) {
        // 창이 없거나 시간 컬럼이 없는 소스는 조건을 참으로 만들어 통째로 넣는다.
        const windowSql =
            since === null || source.timeColumn === undefined
                ? 'TRUE'
                : `${source.timeColumn} >= now() - interval '${since}'`;
        const rows = (await sql.unsafe(
            source.sql.replaceAll('{WINDOW}', windowSql)
        )) as unknown as BackfillRow[];
        // 첫 컬럼을 `AS id`로 별칭하지 않으면 `row.id`가 `undefined`가 되고,
        // 드라이버가 `UNDEFINED_VALUE`로 죽는다. 원본 PK 이름이 테이블마다
        // 다르므로(`symbol`·`normalized_name`) 실수하기 쉽고, 그 테이블이 비어
        // 있으면 **아무 일도 없이 통과한다** — 실제로 그렇게 놓쳤다.
        for (const row of rows) {
            if (typeof row.id !== 'string') {
                throw new Error(
                    `[backfill] ${source.label}: SELECT 첫 컬럼에 \`AS id\` 별칭이 없다`
                );
            }
        }
        console.log(`[backfill] ${source.label}: ${rows.length} row(s)`);
        total += rows.length;
        if (!apply || rows.length === 0) continue;

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE).map(row => ({
                entity: source.entity,
                entity_id: row.id,
                field: row.field,
                locale: DEFAULT_LOCALE,
                value: row.value,
                // 원본 한국어는 사람이 쓴 것도 AI가 만든 것도 있지만 백필은 그
                // 구분을 복원할 수 없다. 약관만 `human`이 필요한데 그건 번역
                // 담당자가 직접 넣는다 — 여기서 승격하면 AI 산출물이 인간
                // 번역으로 둔갑하고, 약관 읽기가 그것을 신뢰한다.
                source: TRANSLATION_SOURCE.ai,
            }));
            await sql`
                INSERT INTO content_translations ${sql(chunk)}
                ON CONFLICT DO NOTHING
            `;
        }
    }
    return total;
}

async function main(): Promise<void> {
    const { databaseUrl, target } = readDatabaseUrl();
    const apply = process.argv.includes('--apply');
    const sinceIdx = process.argv.indexOf('--since');
    const since = parseSince(
        sinceIdx === -1 ? null : (process.argv[sinceIdx + 1] ?? null)
    );
    console.log(
        `[backfill] 창: ${since === null ? '전체' : `최근 ${since}`}` +
            ' (시간 컬럼이 있는 소스에만 적용)'
    );
    if (!apply) {
        console.log('[backfill] dry-run — 실제로 쓰려면 --apply를 붙일 것');
    } else {
        // `.env.local`이 운영을 가리킨다 — `--apply` 하나로 운영에 쓰이지
        // 않도록 원격 대상은 기본 거부한다(§db/scripts/lib/dbTarget.ts).
        assertRemoteWriteAllowed(target, 'backfill');
    }

    const sql = postgres(databaseUrl, { max: 1 });
    try {
        const total = await backfillContentLocale(sql, apply, since);
        console.log(
            `[backfill] ${apply ? 'inserted' : 'would insert'} ${total} row(s)`
        );
    } finally {
        await sql.end();
    }
}

void main().catch((error: unknown) => {
    console.error('[backfill] failed:', error);
    process.exit(1);
});
