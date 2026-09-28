// withRetry 내부 sleep을 즉시 resolve로 stubbing해서 transient retry 케이스의
// 실제 대기 시간을 없앤다. `vi.mock` 은 정적 import 보다 먼저 평가되도록
// 호이스트되어야 한다 (`import/first` 규칙과 일치).
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

// getActiveTerms의 정상 경로가 부르는 getDatabaseClient — 실제 Neon 연결을
// 만들지 않도록 fake db로 대체한다. findActive 자체는 프로토타입을 spy해서
// 검증하므로 이 db 값은 어떤 쿼리도 실행하지 않는다.
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

// React의 `cache()`는 RSC 렌더 스코프(dispatcher) 밖에서는 메모이즈하지
// 않는다 — 실측: plain vitest(node) 환경에서 동일 인자로 두 번 부르면
// 그대로 두 번 다 실행된다. 이 파일은 렌더 트리 없이 함수를 직접 호출하므로
// 실제 dedup 동작을 관찰할 방법이 없다. `getActiveTerms`가 여전히
// `cache()`로 감싸져 있다는 계약(같은 인자 → 구현 1회 호출)을 검증하기 위해
// 결정적인 Map 기반 메모이제이션으로 `cache`를 대체한다.
vi.mock('react', async importOriginal => ({
    ...(await importOriginal<typeof import('react')>()),
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
        const memo = new Map<string, ReturnType<T>>();
        return ((...args: Parameters<T>) => {
            const key = JSON.stringify(args);
            if (!memo.has(key)) memo.set(key, fn(...args) as ReturnType<T>);
            return memo.get(key);
        }) as T;
    },
}));

import { DrizzleTermsRepository, getActiveTerms } from '@/entities/terms/api';
import type { SiglensDatabase } from '@/shared/db/types';
import type { TermsKind } from '@/shared/db/constants';
import type { TermsRecord } from '@/entities/terms';

interface InsertedRow {
    id: string;
    kind: TermsKind;
    version: number;
    effectiveDate: Date;
    body: string;
}

function makeMockDb(rows: InsertedRow[]): SiglensDatabase {
    const builder = {
        from: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: (n: number) => Promise.resolve(rows.slice(0, n)),
    };
    return {
        select: () => builder,
        insert: () => ({
            values: () => ({
                onConflictDoNothing: () => Promise.resolve(),
            }),
        }),
    } as unknown as SiglensDatabase;
}

describe('DrizzleTermsRepository', () => {
    describe('findActive', () => {
        it('returns the latest effective version for the given kind', async () => {
            const effectiveDate = new Date('2026-04-30T00:00:00+09:00');
            const db = makeMockDb([
                {
                    id: 't1',
                    kind: 'privacy',
                    version: 2,
                    effectiveDate,
                    body: '## v2 body',
                },
            ]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('privacy', 'ko');

            expect(result).not.toBeNull();
            expect(result?.kind).toBe('privacy');
            expect(result?.version).toBe(2);
            expect(result?.effectiveDate).toEqual(effectiveDate);
        });

        /**
         * 사이드카에 해당 로케일 인간 번역이 없으면 원문(`row.body`)으로
         * 폴백하고 `isTranslationFallback: true`를 세운다 — 약관이 빈 화면
         * 보다 나은 이유는 클래스 JSDoc(`isTranslationFallback`) 참고.
         */
        it('번역이 없는 로케일은 원문으로 폴백하고 isTranslationFallback을 세운다', async () => {
            const effectiveDate = new Date('2026-04-30T00:00:00+09:00');
            const db = makeMockDb([
                {
                    id: 't1',
                    kind: 'privacy',
                    version: 2,
                    effectiveDate,
                    body: '## 한국어 본문',
                },
            ]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('privacy', 'ja');

            expect(result?.body).toBe('## 한국어 본문');
            expect(result?.bodyLocale).toBe('ko');
            expect(result?.isTranslationFallback).toBe(true);
        });

        /**
         * `pickContentLocale`은 빈 문자열을 "없는 값"으로 본다(분석 실패로
         * 빈 문자열이 들어간 행 대응). 레거시·사이드카 어느 쪽에도 값이 없으면
         * `localizeContentRow`가 `null`을 돌려주므로, `findActive`는 원본
         * `row.body`·`DEFAULT_LOCALE`·`isTranslationFallback: true`로 완전히
         * 폴백해야 한다(모든 `??` 우변).
         */
        it('원문조차 빈 문자열이면 row.body/DEFAULT_LOCALE/true로 완전 폴백한다', async () => {
            const effectiveDate = new Date('2026-04-30T00:00:00+09:00');
            const db = makeMockDb([
                {
                    id: 't1',
                    kind: 'privacy',
                    version: 2,
                    effectiveDate,
                    body: '',
                },
            ]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('privacy', 'ko');

            expect(result?.body).toBe('');
            expect(result?.bodyLocale).toBe('ko');
            expect(result?.isTranslationFallback).toBe(true);
        });

        it('returns null when no active version exists', async () => {
            const db = makeMockDb([]);
            const repo = new DrizzleTermsRepository(db);

            const result = await repo.findActive('tos', 'ko');

            expect(result).toBeNull();
        });
    });

    describe('upsertFromSeed', () => {
        it('calls insert with onConflictDoNothing', async () => {
            const returning = vi.fn().mockResolvedValue([{ id: 'terms-1' }]);
            const onConflict = vi.fn().mockReturnValue({ returning });
            const values = vi.fn().mockReturnValue({
                onConflictDoNothing: onConflict,
            });
            const insert = vi.fn().mockReturnValue({ values });
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleTermsRepository(db);

            await repo.upsertFromSeed({
                kind: 'privacy',
                version: 1,
                effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
                body: '## body',
            });

            expect(insert).toHaveBeenCalledTimes(1);
            expect(values).toHaveBeenCalledWith(
                expect.objectContaining({
                    kind: 'privacy',
                    version: 1,
                    body: '## body',
                })
            );
            expect(onConflict).toHaveBeenCalled();
        });
    });

    // upsertFromSeed 가 NEON_TRANSIENT_RETRY 정책을 실제로 통과시키는지 확인하는
    // smoke 테스트. withRetry/isNeonTransientError 자체 동작은 각자의 단위
    // 테스트에서 검증하므로 여기서는 "정책이 wire-up 됐다"만 보장한다.
    describe('Neon transient retry wire-up', () => {
        const seedInput = {
            kind: 'privacy' as TermsKind,
            version: 1,
            effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
            body: '## body',
        };

        it('transient NeonDbError 가 발생하면 재시도해 결국 성공한다', async () => {
            const neonTransient = Object.assign(
                new Error('Error connecting to database: fetch failed'),
                { name: 'NeonDbError' }
            );
            const returning = vi
                .fn()
                .mockRejectedValueOnce(neonTransient)
                .mockResolvedValueOnce([{ id: 'terms-1' }]);
            const onConflictDoNothing = vi.fn(() => ({ returning }));
            const values = vi.fn(() => ({ onConflictDoNothing }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleTermsRepository(db);

            await expect(repo.upsertFromSeed(seedInput)).resolves.toBe(
                'terms-1'
            );
            expect(insert).toHaveBeenCalledTimes(2);
            expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
        });

        it('non-transient 에러는 재시도 없이 즉시 전파한다', async () => {
            const constraintError = Object.assign(
                new Error(
                    'duplicate key value violates unique constraint "terms_kind_version_unique"'
                ),
                { name: 'NeonDbError' }
            );
            const returning = vi.fn().mockRejectedValueOnce(constraintError);
            const onConflictDoNothing = vi.fn(() => ({ returning }));
            const values = vi.fn(() => ({ onConflictDoNothing }));
            const insert = vi.fn(() => ({ values }));
            const db = { insert } as unknown as SiglensDatabase;
            const repo = new DrizzleTermsRepository(db);

            await expect(repo.upsertFromSeed(seedInput)).rejects.toBe(
                constraintError
            );
            expect(insert).toHaveBeenCalledTimes(1);
        });
    });
});

describe('DrizzleTermsRepository.upsertFromSeed', () => {
    it('새로 삽입하면 그 행의 id를 준다', async () => {
        const returning = vi.fn().mockResolvedValue([{ id: 'terms-1' }]);
        const onConflictDoNothing = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoNothing }));
        const db = {
            insert: vi.fn(() => ({ values })),
        } as unknown as SiglensDatabase;

        const id = await new DrizzleTermsRepository(db).upsertFromSeed({
            kind: 'privacy',
            version: 2,
            effectiveDate: new Date('2026-09-09T00:00:00+09:00'),
            body: '## 1. 총칙',
        });

        expect(id).toBe('terms-1');
    });

    it('이미 있는 버전이면 기존 행의 id를 조회해 준다', async () => {
        // 충돌하면 returning이 빈 배열이다 — 번역을 붙이려면 id가 여전히 필요하다.
        const returning = vi.fn().mockResolvedValue([]);
        const onConflictDoNothing = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoNothing }));
        const limit = vi.fn().mockResolvedValue([{ id: 'terms-existing' }]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        const db = {
            insert: vi.fn(() => ({ values })),
            select: vi.fn(() => ({ from })),
        } as unknown as SiglensDatabase;

        const id = await new DrizzleTermsRepository(db).upsertFromSeed({
            kind: 'privacy',
            version: 1,
            effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
            body: '## 1. 총칙',
        });

        expect(id).toBe('terms-existing');
    });

    /**
     * 충돌은 났는데(returning 빈 배열) 조회로도 기존 행을 못 찾는 경우 — 이론상
     * 불가능해야 하지만(방금 충돌한 (kind,version)이 곧바로 사라짐), 벌어지면
     * 조용히 undefined id를 돌려주는 대신 명시적으로 실패해야 한다. 그래야
     * 번역 사이드카가 존재하지 않는 termsId를 참조하는 사고를 막는다.
     */
    it('충돌했는데 기존 행도 못 찾으면 에러를 던진다', async () => {
        const returning = vi.fn().mockResolvedValue([]);
        const onConflictDoNothing = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoNothing }));
        const limit = vi.fn().mockResolvedValue([]);
        const where = vi.fn(() => ({ limit }));
        const from = vi.fn(() => ({ where }));
        const db = {
            insert: vi.fn(() => ({ values })),
            select: vi.fn(() => ({ from })),
        } as unknown as SiglensDatabase;

        await expect(
            new DrizzleTermsRepository(db).upsertFromSeed({
                kind: 'privacy',
                version: 1,
                effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
                body: '## 1. 총칙',
            })
        ).rejects.toThrow('terms privacy v1 not found after upsert');
    });
});

describe('DrizzleTermsRepository.upsertTranslation', () => {
    it('human 출처로 사이드카에 넣고 재실행하면 갱신한다', async () => {
        const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const db = {
            insert: vi.fn(() => ({ values })),
        } as unknown as SiglensDatabase;

        await new DrizzleTermsRepository(db).upsertTranslation({
            termsId: 'terms-1',
            locale: 'en',
            body: '## 1. General',
        });

        expect(values).toHaveBeenCalledWith(
            expect.objectContaining({
                entity: 'terms',
                entityId: 'terms-1',
                field: 'body',
                locale: 'en',
                value: '## 1. General',
                // 약관 읽기 경로는 source='human' 행만 신뢰한다.
                source: 'human',
            })
        );
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    });
});

describe('getActiveTerms', () => {
    const ORIGINAL_OFFLINE_BUILD = process.env.SIGLENS_OFFLINE_BUILD;
    const RECORD: TermsRecord = {
        id: 'terms-1',
        kind: 'tos',
        version: 1,
        effectiveDate: new Date('2026-04-30T00:00:00+09:00'),
        body: '## body',
        bodyLocale: 'ko',
        isTranslationFallback: false,
    };

    afterEach(() => {
        if (ORIGINAL_OFFLINE_BUILD === undefined) {
            delete process.env.SIGLENS_OFFLINE_BUILD;
        } else {
            process.env.SIGLENS_OFFLINE_BUILD = ORIGINAL_OFFLINE_BUILD;
        }
        vi.restoreAllMocks();
    });

    it('오프라인 빌드에서는 DB를 보지 않고 null을 돌려준다', async () => {
        process.env.SIGLENS_OFFLINE_BUILD = '1';
        const findActive = vi.spyOn(
            DrizzleTermsRepository.prototype,
            'findActive'
        );

        const result = await getActiveTerms('tos', 'ko');

        expect(result).toBeNull();
        expect(findActive).not.toHaveBeenCalled();
    });

    it('정상 경로에서는 repository.findActive를 요청한 kind/locale로 호출한다', async () => {
        delete process.env.SIGLENS_OFFLINE_BUILD;
        const findActive = vi
            .spyOn(DrizzleTermsRepository.prototype, 'findActive')
            .mockResolvedValue(RECORD);

        const result = await getActiveTerms('privacy', 'en');

        expect(findActive).toHaveBeenCalledWith('privacy', 'en');
        expect(result).toBe(RECORD);
    });

    it('cache()로 감싸져 있어 같은 인자 호출은 repository를 한 번만 부른다', async () => {
        delete process.env.SIGLENS_OFFLINE_BUILD;
        const findActive = vi
            .spyOn(DrizzleTermsRepository.prototype, 'findActive')
            .mockResolvedValue(RECORD);

        // mock한 cache()는 파일 전체에서 인자별로 메모이즈하므로, 다른 테스트가
        // 이미 쓴 kind/locale 조합('tos'+'ko', 'privacy'+'en')과 겹치지 않는
        // 조합을 쓴다.
        await getActiveTerms('privacy', 'ja');
        await getActiveTerms('privacy', 'ja');

        expect(findActive).toHaveBeenCalledTimes(1);
    });
});
