/**
 * `DB_CONTENT_LOCALE` 스위치를 켜기 **전/후** 확인용 점검.
 *
 *   yarn db:verify:content-locale
 *
 * 배포 순서(설계 §2.5.3)의 4단계에서 돌린다. 확인하는 것:
 *
 * 1. 마이그레이션이 적용됐는가 (`content_translations`·`locale` 컬럼 존재)
 * 2. 백필이 돌았는가 (ko 행이 있는가)
 * 3. 폴백 체인이 의도대로 도는가 — 로케일별로 실제 SELECT를 쳐 본다
 *
 * **읽기 전용이다.** 어떤 행도 쓰지 않는다.
 *
 * 왜 필요한가: 3단계(백필)를 건너뛰고 4단계를 켜면 화면은 멀쩡하다(사이드카가
 * 비어 폴백). 무동작이라 "켰는데 아무것도 안 바뀐다"가 되는데, 그 원인이
 * 마이그레이션인지 백필인지 스위치인지 화면만 봐서는 구분되지 않는다.
 *
 * `src/shared/db/client|schema|types`를 import하지 않는 이유는
 * `backfillContentLocale.ts`와 같다(`server-only`는 Next 번들러 가상 모듈이라
 * `tsx`에서 해석되지 않는다). `contentLocale.ts`는 `server-only`가 없는 순수
 * 모듈이라 폴백 체인을 그대로 가져다 쓴다.
 */
import postgres from 'postgres';
import { readDatabaseUrl } from './lib/dbTarget';
import { LOCALES } from '../../src/shared/i18n/locales';
// 폴백 체인은 **복제하지 않고 그대로 쓴다**. `contentLocale.ts`에는
// `import 'server-only'`가 없어(`client.ts`/`schema.ts`와 다르다) `tsx`에서
// 그대로 해석된다 — 복제하면 진짜 체인이 바뀌었을 때 점검만 옛 값을 보고
// "정상"이라 보고한다(감사 라운드 1 recommended #2).
import { CONTENT_LOCALE_FALLBACK } from '../../src/shared/db/contentLocale';

interface CheckResult {
    readonly label: string;
    readonly ok: boolean;
    readonly detail: string;
}

async function checkSchema(sql: postgres.Sql): Promise<CheckResult[]> {
    const [sidecar] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
             WHERE table_name = 'content_translations'
        ) AS exists
    `;
    const columns = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.columns
         WHERE column_name = 'locale'
           AND table_name IN ('shared_analyses', 'seo_analysis_snapshots')
    `;
    return [
        {
            label: 'content_translations 테이블',
            ok: sidecar?.exists === true,
            detail:
                sidecar?.exists === true
                    ? '있음'
                    : '없음 — 마이그레이션 미적용',
        },
        {
            label: 'locale 컬럼 (shared_analyses, seo_analysis_snapshots)',
            ok: columns.length === 2,
            detail: `${columns.length}/2`,
        },
    ];
}

async function checkBackfill(sql: postgres.Sql): Promise<CheckResult[]> {
    const rows = await sql<{ locale: string; count: string }[]>`
        SELECT locale, count(*)::text AS count
          FROM content_translations GROUP BY locale ORDER BY locale
    `;
    const byLocale = new Map(rows.map(row => [row.locale, Number(row.count)]));
    const ko = byLocale.get('ko') ?? 0;
    return [
        {
            label: '백필 (ko 행)',
            ok: ko > 0,
            detail:
                ko > 0
                    ? `${ko}행`
                    : '0행 — `yarn db:backfill:content-locale --apply` 필요',
        },
        ...LOCALES.filter(locale => locale !== 'ko').map(locale => ({
            label: `번역 (${locale})`,
            // 번역이 없는 것은 결함이 아니라 **아직 안 한 것**이다 — 폴백이
            // 동작하므로 화면은 정상이다. 그래서 ok는 항상 true고, 숫자만 알린다.
            ok: true,
            detail: `${byLocale.get(locale) ?? 0}행`,
        })),
    ];
}

/**
 * 폴백 체인을 실제 SELECT로 확인한다.
 *
 * 상수 비교가 아니라 쿼리를 치는 이유: `IN (체인)` + 앱 쪽 정렬이라는 조합이
 * 실제 데이터에서 의도대로 도는지는 코드를 읽어서는 알 수 없다.
 */
async function checkFallback(sql: postgres.Sql): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    for (const locale of LOCALES) {
        const chain = CONTENT_LOCALE_FALLBACK[locale];
        const rows = await sql<{ locale: string }[]>`
            SELECT DISTINCT locale FROM content_translations
             WHERE locale = ANY(${chain as unknown as string[]})
        `;
        const found = rows.map(row => row.locale);
        const best = chain.find(candidate => found.includes(candidate)) ?? null;
        results.push({
            label: `폴백 ${locale} → [${chain.join(', ')}]`,
            ok: best !== null,
            detail:
                best === null
                    ? '해당 체인에 행이 하나도 없음'
                    : `${best}${best === locale ? '' : ' (폴백)'}`,
        });
    }
    return results;
}

async function main(): Promise<void> {
    // 읽기 전용이라 원격을 막지 않는다. 다만 **대상은 반드시 찍는다** — 어느
    // DB를 봤는지 모르는 채로 "정상"이라고 보고하는 것이 가장 위험하다.
    const { databaseUrl } = readDatabaseUrl();
    const sql = postgres(databaseUrl, { max: 1 });
    try {
        const schema = await checkSchema(sql);
        const schemaOk = schema.every(check => check.ok);
        const checks = schemaOk
            ? [
                  ...schema,
                  ...(await checkBackfill(sql)),
                  ...(await checkFallback(sql)),
              ]
            : schema;

        for (const check of checks) {
            console.log(
                `${check.ok ? '✓' : '✗'} ${check.label}: ${check.detail}`
            );
        }
        const switchOn = process.env.DB_CONTENT_LOCALE === '1';
        console.log(
            `\n스위치 DB_CONTENT_LOCALE: ${switchOn ? 'ON' : 'OFF'}${
                switchOn || schemaOk ? '' : ' (스키마 미적용 — 켜면 안 됨)'
            }`
        );
        if (!checks.every(check => check.ok)) process.exit(1);
    } finally {
        await sql.end();
    }
}

void main().catch((error: unknown) => {
    console.error('[verify] failed:', error);
    process.exit(1);
});
