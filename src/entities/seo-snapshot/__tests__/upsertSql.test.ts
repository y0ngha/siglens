import { afterEach, beforeEach } from 'vitest';

const ORIGINAL = process.env.DB_CONTENT_LOCALE;

beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DB_CONTENT_LOCALE;
    else process.env.DB_CONTENT_LOCALE = ORIGINAL;
});

/**
 * **생성된 SQL을 본다 — values 객체가 아니라. 그리고 프로덕션 코드를 통해서.**
 *
 * 기존 upsert 테스트는 `db.insert`를 `vi.fn()`으로 갈아 끼우고 넘긴 values
 * 객체를 단언한다. 그래서 "값에서 `locale`을 빼면 SQL에서도 빠진다"는 **거짓
 * 전제**를 검증할 수 없었다 — Drizzle은 스키마에 있는 컬럼을 값에서 빼도
 * `default`로 항상 INSERT에 넣는다. 그 사각지대가 배포 감사에서 P0으로 잡혔다.
 *
 * 이 파일의 첫 판은 그 지적을 받아 `.toSQL()`을 보게 했지만, **조건 분기를
 * 테스트 안에 복사**해 뒀다. 생성기와 가드가 같은 코드를 두 벌 갖고 있으면
 * 함께 틀린다. 지금은 진짜 `DrizzleSeoSnapshotRepository.upsert`를 부르고,
 * 그것이 만든 쿼리를 가로채 SQL을 뽑는다.
 */
async function upsertSql(): Promise<string> {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { DrizzleSeoSnapshotRepository } =
        await import('@/entities/seo-snapshot/api');
    // 세션 없는 drizzle — 쿼리 빌드는 되지만 실행하면 던진다. 실행 직전에
    // 가로채므로 DB가 필요 없다.
    const real = drizzle({} as never, { schema: {} });

    let captured = '';
    const db = {
        insert: (table: never) => {
            const builder = real.insert(table);
            return {
                values: (rows: never) => {
                    const withValues = builder.values(rows);
                    return {
                        onConflictDoUpdate: (config: never) => {
                            captured = withValues
                                .onConflictDoUpdate(config)
                                .toSQL().sql;
                            return Promise.resolve();
                        },
                    };
                },
            };
        },
    };

    await new DrizzleSeoSnapshotRepository(db as never).upsert({
        symbol: 'aapl',
        tab: 'technical',
        locale: 'ko',
        content: {},
        plain: null,
        model: 'm',
        generatedAt: new Date(),
    });
    return captured;
}

describe('seo_analysis_snapshots upsert SQL', () => {
    /**
     * **스위치와 무관하게 3열이다.**
     *
     * 예전엔 꺼져 있으면 `(symbol, tab)`으로 돌아갔다. 그러면 0030(구 unique
     * 제거)을 적용할 수 있는 시점이 "스위치가 전 인스턴스에서 켜진 뒤"로
     * 밀리는데, 스위치가 켜지면 비-ko 스냅샷이 쓰이기 시작하고 구 unique가
     * 아직 있으면 그 쓰기가 23505로 죽는다(로컬 Postgres 17 실측). 어느
     * 순서로도 창이 남는 설계였다.
     */
    it.each(['off', 'on'])(
        '스위치 %s: ON CONFLICT 대상이 (symbol, tab, locale)',
        async state => {
            if (state === 'on') process.env.DB_CONTENT_LOCALE = '1';
            else delete process.env.DB_CONTENT_LOCALE;

            const sql = await upsertSql();
            expect(sql).toContain(
                'on conflict ("symbol","tab","locale") do update'
            );
        }
    );

    /**
     * 스위치와 무관하게 `locale`은 항상 INSERT에 들어간다 — 값에서 빼도
     * Drizzle이 `default`로 넣기 때문이다. 이 사실이 배포 순서를
     * "스키마 먼저, 코드 나중"으로 강제한다.
     */
    it.each(['off', 'on'])(
        '스위치 %s: locale이 INSERT 컬럼에 있다',
        async state => {
            if (state === 'on') process.env.DB_CONTENT_LOCALE = '1';
            else delete process.env.DB_CONTENT_LOCALE;
            expect(await upsertSql()).toContain('"locale"');
        }
    );
});
