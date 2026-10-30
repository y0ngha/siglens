import type { Mock } from 'vitest';
// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 retry 케이스의 실제
// 대기 시간을 없앤다. retry 발생 시 sleep이 호출되는 것만 검증.
// `vi.mock` 은 import 위로 호이스트되어야 static import 보다 먼저 평가된다
// (`import/first` 규칙과 일치).
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import type { NewsCardAnalysis, NewsItem } from '@y0ngha/siglens-core';
import type { SiglensDatabase } from '@/shared/db/types';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import type { NewsRow } from '@/entities/news-article/api';
import { orderColumnName } from '@/__tests__/utils/orderColumnName';

const baseItem: NewsItem = {
    id: 'abc123',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://example.com/news/1',
    publishedAt: '2025-08-01T10:00:00.000Z',
    titleEn: 'Apple hits all-time high',
    bodyEn: 'The stock reached a new record.',
};

const analysis: NewsCardAnalysis = {
    titleKo: '애플 사상 최고가 달성',
    bodyKo: '주가가 신기록을 세웠다.',
    summaryKo: '애플 주가 신기록.',
    sentiment: 'bullish',
    category: 'other',
    priceImpact: 'medium',
};

// --- DB mock helpers ---

/**
 * Build a mock `db` that handles insert→values→onConflictDoUpdate→returning chains.
 * `returningRows` controls what `.returning()` resolves to, enabling boolean-return tests.
 */
interface UpsertDbMock {
    db: SiglensDatabase;
    insert: Mock;
    values: Mock;
    onConflictDoUpdate: Mock;
    returning: Mock;
}

function makeUpsertDb(
    returningRows: unknown[] = [{ id: 'abc123' }]
): UpsertDbMock {
    const returning = vi.fn().mockResolvedValue(returningRows);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    return {
        db: { insert } as unknown as SiglensDatabase,
        insert,
        values,
        onConflictDoUpdate,
        returning,
    };
}

/** Build a mock `db` that handles update→set→where chains. */
function makeUpdateDb(): {
    db: SiglensDatabase;
    update: Mock;
    set: Mock;
    where: Mock;
} {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    return {
        db: { update } as unknown as SiglensDatabase,
        update,
        set,
        where,
    };
}

/** Build a mock `db` for a select…where…orderBy chain returning `rows`. */
/**
 * drizzle `SQL` 객체에서 리터럴 조각만 뽑는다. `JSON.stringify`는 테이블 참조가
 * 순환이라 던지므로 쓸 수 없다. `isNotNull`은 `' is not null'`, `isNull`은
 * `' is null'` 조각을 남기므로 필터 방향을 이걸로 판별한다.
 */
function sqlChunks(node: unknown, out: string[] = []): string[] {
    if (Array.isArray(node)) {
        for (const item of node) sqlChunks(item, out);
        return out;
    }
    if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj.queryChunks)) sqlChunks(obj.queryChunks, out);
        if (
            Array.isArray(obj.value) &&
            obj.value.every(v => typeof v === 'string')
        ) {
            out.push(...(obj.value as string[]));
        }
    }
    return out;
}

/**
 * `listAnalyzedIds`용 — 이 쿼리는 `orderBy` 없이 `where()`를 바로 await한다.
 * `where` 인자를 노출해 필터 자체(`is not null`)를 단언할 수 있게 한다.
 */
function makeFilterSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    where: Mock;
} {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as SiglensDatabase, where };
}

function makeSelectDb(rows: unknown[]): {
    db: SiglensDatabase;
    select: Mock;
    orderBy: Mock;
} {
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return {
        db: { select } as unknown as SiglensDatabase,
        select,
        orderBy,
    };
}

// --- Tests ---

describe('DrizzleNewsRepository', () => {
    describe('upsertNewsItem', () => {
        it('신규 삽입(returning 행 있음) 시 true를 반환한다', async () => {
            const { db } = makeUpsertDb([{ id: 'abc123' }]);
            const repo = new DrizzleNewsRepository(db);
            const result = await repo.upsertNewsItem(baseItem);
            expect(result).toBe(true);
        });

        it('동일 내용 재fetch(returning 빈 배열) 시 false를 반환한다', async () => {
            const { db } = makeUpsertDb([]);
            const repo = new DrizzleNewsRepository(db);
            const result = await repo.upsertNewsItem(baseItem);
            expect(result).toBe(false);
        });

        it('insert + onConflictDoUpdate + returning 체인을 호출한다', async () => {
            const { db, insert, values, onConflictDoUpdate, returning } =
                makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem(baseItem);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledTimes(1);
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
            expect(returning).toHaveBeenCalledTimes(1);

            const row = values.mock.calls[0][0] as Record<string, unknown>;
            expect(row['id']).toBe('abc123');
            expect(row['symbol']).toBe('AAPL');
            expect(row['url']).toBe('https://example.com/news/1');
        });

        it('bodyEn 이 null 인 항목도 정상 삽입된다', async () => {
            const { db, values } = makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem({ ...baseItem, bodyEn: null });

            const row = values.mock.calls[0][0] as Record<string, unknown>;
            expect(row['bodyEn']).toBeNull();
        });

        it('conflict 경로에서 publishedAt도 갱신하고 setWhere를 포함한다', async () => {
            const { db, onConflictDoUpdate } = makeUpsertDb();
            const repo = new DrizzleNewsRepository(db);
            await repo.upsertNewsItem(baseItem);

            const conflictArg = onConflictDoUpdate.mock.calls[0][0] as {
                set: Record<string, unknown>;
                setWhere: unknown;
            };
            expect(conflictArg.set).toHaveProperty('publishedAt');
            // setWhere는 Drizzle `sql` 태그드 객체(`queryChunks` 보유)여야 한다 — 변경 여부 필터링용.
            // toBeDefined()만으론 setWhere 미전달과 빈 객체 차이를 잡지 못해 정밀 단언으로 보강.
            expect(conflictArg.setWhere).toEqual(
                expect.objectContaining({ queryChunks: expect.any(Array) })
            );
        });

        it('DB transient 에러 발생 후 재시도해 성공하면 boolean을 반환한다', async () => {
            // 첫 chain은 returning에서 transient 연결 에러를 던지고,
            // 두 번째 chain은 성공해야 retry 정책이 의도대로 동작함을 보장한다.
            const dbTransient = Object.assign(
                new Error('write CONNECTION_CLOSED db.example:5432'),
                { code: 'CONNECTION_CLOSED' }
            );
            const returning = vi
                .fn()
                .mockRejectedValueOnce(dbTransient)
                .mockResolvedValueOnce([{ id: 'abc123' }]);
            const onConflictDoUpdate = vi.fn(() => ({ returning }));
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;

            const repo = new DrizzleNewsRepository(db);
            // transient 에러 후 retry → boolean(true) 반환
            await expect(repo.upsertNewsItem(baseItem)).resolves.toBe(true);

            // insert chain이 두 번 재구성됐는지 확인 — 동일 promise를 await 한 것이 아니라
            // 매 retry마다 새 query builder를 만들고 있다는 증거.
            expect(insert).toHaveBeenCalledTimes(2);
            expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
        });

        it('non-transient 에러는 재시도 없이 즉시 전파한다 (false가 아닌 reject)', async () => {
            // Constraint 위반 같은 영구 에러는 retry 해도 동일하게 실패할 뿐이므로
            // 첫 시도에서 즉시 throw 되어야 하며, false로 삼키면 안 된다.
            const constraintError = Object.assign(
                new Error(
                    'duplicate key value violates unique constraint "news_pkey"'
                ),
                { name: 'PostgresError', code: '23505' }
            );
            const returning = vi.fn().mockRejectedValueOnce(constraintError);
            const onConflictDoUpdate = vi.fn(() => ({ returning }));
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;

            const repo = new DrizzleNewsRepository(db);
            await expect(repo.upsertNewsItem(baseItem)).rejects.toBe(
                constraintError
            );
            expect(insert).toHaveBeenCalledTimes(1);
        });
    });

    describe('attachAnalysis', () => {
        it('update + set + where 를 호출한다', async () => {
            const { db, update, set, where } = makeUpdateDb();
            const repo = new DrizzleNewsRepository(db);
            const analyzedAt = new Date('2025-08-01T12:00:00.000Z');
            await repo.attachAnalysis('abc123', analysis, analyzedAt);

            expect(update).toHaveBeenCalledTimes(1);
            expect(set).toHaveBeenCalledTimes(1);
            expect(where).toHaveBeenCalledTimes(1);

            const setArg = set.mock.calls[0][0] as Record<string, unknown>;
            expect(setArg['titleKo']).toBe('애플 사상 최고가 달성');
            expect(setArg['sentiment']).toBe('bullish');
            expect(setArg['category']).toBe('other');
            expect(setArg['priceImpact']).toBe('medium');
            expect(setArg['analyzedAt']).toBe(analyzedAt);
        });
    });

    /**
     * 동률 tie-break를 **인자 수준에서** 고정한다. 기존 테스트는 `orderBy` 호출 횟수만
     * 봐서, 2차 키를 지워도 전부 통과했다. 소비자가 앞에서 N개를 잘라 쓰는 지금은
     * 동률의 상대 순서가 정해지지 않으면 재생성마다 다른 행이 살아남아 ISR 블롭이 흔들린다.
     */
    describe('정렬 tie-break', () => {
        it('listBySymbol은 publishedAt desc 다음 id desc로 정렬한다', async () => {
            const { db, orderBy } = makeSelectDb([]);

            await new DrizzleNewsRepository(db).listBySymbol(
                'AAPL',
                86_400_000
            );

            expect(orderBy.mock.calls[0]!.map(orderColumnName)).toEqual([
                'published_at desc',
                'id desc',
            ]);
        });

        it('listCardsBySymbol도 같은 tie-break를 쓴다', async () => {
            const { db, orderBy } = makeSelectDb([]);

            await new DrizzleNewsRepository(db).listCardsBySymbol(
                'AAPL',
                86_400_000,
                'ko'
            );

            expect(orderBy.mock.calls[0]!.map(orderColumnName)).toEqual([
                'published_at desc',
                'id desc',
            ]);
        });
    });

    describe('listBySymbol', () => {
        interface DbRow {
            id: string;
            symbol: string;
            source: string;
            url: string;
            publishedAt: Date;
            titleEn: string;
            bodyEn: string | null;
            titleKo: string | null;
            bodyKo: string | null;
            summaryKo: string | null;
            sentiment: string | null;
            category: string | null;
            priceImpact: string | null;
            analyzedAt: Date | null;
        }

        const dbRow: DbRow = {
            id: 'abc123',
            symbol: 'AAPL',
            source: 'Reuters',
            url: 'https://example.com/news/1',
            publishedAt: new Date('2025-08-01T10:00:00.000Z'),
            titleEn: 'Apple hits all-time high',
            bodyEn: 'The stock reached a new record.',
            titleKo: null,
            bodyKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            priceImpact: null,
            analyzedAt: null,
        };

        it('publishedAt 을 ISO 문자열로 변환해 반환한다', async () => {
            const { db } = makeSelectDb([dbRow]);
            const repo = new DrizzleNewsRepository(db);
            const results = await repo.listBySymbol('AAPL', 86_400_000);

            expect(results).toHaveLength(1);
            expect(results[0]?.publishedAt).toBe('2025-08-01T10:00:00.000Z');
        });

        it('기사 원문(body_en)은 읽지 않고 null로 내려준다', async () => {
            // 이 읽기의 소비자(집계 분석 프롬프트)가 원문을 쓰지 않는다 — core에서
            // `bodyEn`을 읽는 곳은 카드 프롬프트뿐이고 그 입력은 DB 행이 아니라 FMP
            // 응답이다. core가 집계 쪽에서 읽기 시작하면 이 값이 조용히 null이 되어
            // 품질만 떨어지므로, 계약을 여기서 고정한다.
            const { db, select } = makeSelectDb([dbRow]);
            const repo = new DrizzleNewsRepository(db);

            const [result] = await repo.listBySymbol('AAPL', 86_400_000);

            expect(result?.bodyEn).toBeNull();
            expect(
                Object.keys(
                    (select.mock.calls[0] as [Record<string, unknown>])[0]
                )
            ).not.toContain('bodyEn');
        });

        it('결과가 없으면 빈 배열을 반환한다', async () => {
            const { db } = makeSelectDb([]);
            const repo = new DrizzleNewsRepository(db);
            const results = await repo.listBySymbol('AAPL', 86_400_000);
            expect(results).toEqual([]);
        });

        it('분석 완료 row 는 sentiment/category 를 포함한다', async () => {
            const analyzedRow: DbRow = {
                ...dbRow,
                titleKo: '애플 사상 최고가 달성',
                summaryKo: '애플 주가 신기록.',
                sentiment: 'bullish',
                category: 'other',
                priceImpact: 'medium',
                analyzedAt: new Date('2025-08-01T12:00:00.000Z'),
            };
            const { db } = makeSelectDb([analyzedRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBe('bullish');
            expect(result.category).toBe('other');
            expect(result.titleKo).toBe('애플 사상 최고가 달성');
        });

        it('알 수 없는 enum 문자열은 null 로 정규화한다', async () => {
            // DB에 (수동 SQL 또는 스키마 변경 등으로) 등록되지 않은 값이 들어오면
            // 표시 단의 fallback이 처리할 수 있도록 read 시점에 null로 떨어뜨려야 한다.
            const corruptRow: DbRow = {
                ...dbRow,
                sentiment: 'unknown_value',
                category: 'unknown_category',
                priceImpact: 'unknown_impact',
            };
            const { db } = makeSelectDb([corruptRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBeNull();
            expect(result.category).toBeNull();
            expect(result.priceImpact).toBeNull();
        });

        it('비문자열 enum 값은 null 로 정규화한다', async () => {
            // 타입 시스템 우회 또는 마이그레이션 사고로 비문자열이 들어와도
            // crash 없이 null로 강등시켜야 한다.
            const malformedRow = {
                ...dbRow,
                sentiment: 42,
                category: true,
                priceImpact: { broken: 'shape' },
            } as unknown as DbRow;
            const { db } = makeSelectDb([malformedRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = (await repo.listBySymbol('AAPL', 86_400_000)) as [
                NewsRow,
            ];

            expect(result.sentiment).toBeNull();
            expect(result.category).toBeNull();
            expect(result.priceImpact).toBeNull();
        });
    });

    /**
     * 카드 폴링 전용 투영. `listBySymbol`의 정규화(enum 화이트리스트, Date→ISO,
     * 180일 창, 최신순)를 그대로 다시 구현하므로 같은 케이스를 여기서도 고정한다 —
     * 안 하면 두 사본이 조용히 갈라지고, 갈라지는 쪽이 하필 3초 폴링 경로다
     *.
     *
     * enum 정규화가 특히 중요하다: `hasAnyEnrichedCard`/`hasPendingAnalysis`가
     * `sentiment === null`로 보강 여부를 판정하므로, 깨진 문자열이 그대로 흘러가면
     * 미보강 종목이 "보강됨"으로 읽혀 폴링이 일찍 멈추고 분석 패널이 열린다.
     */
    /**
     * [회귀] 이 메서드의 전부는 `isNotNull(analyzedAt)` 한 줄이다 — 뒤집으면
     * 이미 분석된 기사를 매번 LLM에 다시 보내고 미분석 기사는 영영 안 돈다.
     * 호출부 테스트는 이 메서드를 통째로 mock하므로 SQL을 볼 수 없다
     *.
     */
    describe('listAnalyzedIds', () => {
        it('분석 완료 행만 거르는 필터를 건다', async () => {
            const { db, where } = makeFilterSelectDb([
                { id: 'a' },
                { id: 'b' },
            ]);
            const repo = new DrizzleNewsRepository(db);

            const ids = await repo.listAnalyzedIds('AAPL', 86_400_000);

            expect(ids).toEqual(new Set(['a', 'b']));
            // drizzle의 `isNotNull`은 ' is not null' 조각을, `isNull`은 ' is null'
            // 조각을 남긴다 — 방향이 뒤집히면 여기서 걸린다.
            const literals = sqlChunks((where.mock.calls[0] as [unknown])[0]);
            expect(literals).toContain(' is not null');
            expect(literals).not.toContain(' is null');
        });

        it('결과가 없으면 빈 Set을 돌려준다', async () => {
            const { db } = makeFilterSelectDb([]);
            const repo = new DrizzleNewsRepository(db);

            await expect(
                repo.listAnalyzedIds('AAPL', 86_400_000)
            ).resolves.toEqual(new Set());
        });
    });

    describe('listCardsBySymbol', () => {
        // 픽스처가 서버 전용 컬럼을 **갖고 있어야** 한다 — 안 그러면 투영을 통째로
        // 되돌려(`...row` spread) 놓아도 샐 것이 없어 테스트가 통과한다
        //. DB는 그 컬럼들을 갖고 있으므로 이쪽이 실제 형상이다.
        const cardRow = {
            symbol: 'AAPL',
            bodyEn: '유출되면 안 되는 영어 원문',
            analyzedAt: new Date('2025-08-01T12:00:00.000Z'),
            id: 'abc123',
            source: 'Reuters',
            url: 'https://example.com/news/1',
            publishedAt: new Date('2025-08-01T10:00:00.000Z'),
            titleEn: 'Apple hits all-time high',
            titleKo: '애플 사상 최고가',
            bodyKo: '본문',
            summaryKo: '요약',
            sentiment: 'bullish',
            category: 'other',
            priceImpact: 'medium',
        };

        it('DB 내부 필드를 아예 읽지 않는다', async () => {
            const { db, select } = makeSelectDb([cardRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = await repo.listCardsBySymbol(
                'AAPL',
                86_400_000,
                'ko'
            );

            // 반환 형상: 새어 나오지 않는다.
            expect(result).not.toHaveProperty('bodyEn');
            expect(result).not.toHaveProperty('symbol');
            expect(result).not.toHaveProperty('analyzedAt');

            // SELECT 목록: 애초에 읽지 않는다 — 비용 근거가 여기 있다.
            // 반환 형상만 보면 select에 남겨 둔 채 매핑에서만 빼도 통과한다.
            const selected = Object.keys(
                (select.mock.calls[0] as [Record<string, unknown>])[0]
            );
            expect(selected).not.toContain('bodyEn');
            expect(selected).not.toContain('symbol');
            expect(selected).not.toContain('analyzedAt');
        });

        it('publishedAt 을 ISO 문자열로 변환해 반환한다', async () => {
            const { db } = makeSelectDb([cardRow]);
            const repo = new DrizzleNewsRepository(db);
            const results = await repo.listCardsBySymbol(
                'AAPL',
                86_400_000,
                'ko'
            );

            expect(results[0]?.publishedAt).toBe('2025-08-01T10:00:00.000Z');
        });

        it('결과가 없으면 빈 배열을 반환한다', async () => {
            const { db } = makeSelectDb([]);
            const repo = new DrizzleNewsRepository(db);
            await expect(
                repo.listCardsBySymbol('AAPL', 86_400_000, 'ko')
            ).resolves.toEqual([]);
        });

        it('표시 필드를 그대로 옮긴다', async () => {
            const { db } = makeSelectDb([cardRow]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = await repo.listCardsBySymbol(
                'AAPL',
                86_400_000,
                'ko'
            );

            expect(result).toEqual({
                id: 'abc123',
                source: 'Reuters',
                url: 'https://example.com/news/1',
                publishedAt: '2025-08-01T10:00:00.000Z',
                titleEn: 'Apple hits all-time high',
                titleKo: '애플 사상 최고가',
                bodyKo: '본문',
                summaryKo: '요약',
                sentiment: 'bullish',
                category: 'other',
                priceImpact: 'medium',
            });
        });

        it('알 수 없는 enum 문자열은 null 로 정규화한다', async () => {
            const { db } = makeSelectDb([
                {
                    ...cardRow,
                    sentiment: 'unknown_value',
                    category: 'unknown_category',
                    priceImpact: 'unknown_impact',
                },
            ]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = await repo.listCardsBySymbol(
                'AAPL',
                86_400_000,
                'ko'
            );

            expect(result?.sentiment).toBeNull();
            expect(result?.category).toBeNull();
            expect(result?.priceImpact).toBeNull();
        });

        it('비문자열 enum 값은 null 로 정규화한다', async () => {
            const { db } = makeSelectDb([
                {
                    ...cardRow,
                    sentiment: 42 as unknown as string,
                    category: {} as unknown as string,
                    priceImpact: [] as unknown as string,
                },
            ]);
            const repo = new DrizzleNewsRepository(db);
            const [result] = await repo.listCardsBySymbol(
                'AAPL',
                86_400_000,
                'ko'
            );

            expect(result?.sentiment).toBeNull();
            expect(result?.category).toBeNull();
            expect(result?.priceImpact).toBeNull();
        });
    });
});
