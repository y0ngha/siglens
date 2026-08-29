import {
    ContentTranslations,
    DrizzleContentTranslationRepository,
    NullContentTranslationRepository,
} from '@/shared/db/contentTranslationRepository';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
    TRANSLATION_SOURCE,
} from '@/shared/db/contentTranslationFields';
import type { SiglensDatabase } from '@/shared/db/types';

interface StubRow {
    entityId: string;
    field: string;
    locale: string;
    value: string;
    source: string;
}

/** `select().from().where()` 체인만 흉내 낸다 — 이 리포지터리가 쓰는 전부다. */
function stubDb(rows: StubRow[]): {
    db: SiglensDatabase;
    calls: { count: number };
} {
    const calls = { count: 0 };
    const db = {
        select: () => ({
            from: () => ({
                where: () => {
                    calls.count += 1;
                    return Promise.resolve(rows);
                },
            }),
        }),
    } as unknown as SiglensDatabase;
    return { db, calls };
}

describe('NullContentTranslationRepository', () => {
    /**
     * 마이그레이션 전 배포에서 사이드카를 조회하면
     * `relation "content_translations" does not exist`로 읽기 경로 전체가
     * 죽는다 — 뉴스 목록이 통째로 빈 화면이 된다. Null 구현은 그 사이를 메운다.
     */
    it('항상 빈 결과를 돌려준다', async () => {
        const result =
            await new NullContentTranslationRepository().findForEntity();
        expect(result.byLocale('any', 'title')).toEqual({});
    });
});

describe('DrizzleContentTranslationRepository', () => {
    it('id 목록이 비면 쿼리하지 않는다', async () => {
        const { db, calls } = stubDb([]);
        await new DrizzleContentTranslationRepository(db).findForEntity(
            TRANSLATABLE_ENTITY.news,
            [],
            'ja'
        );
        expect(calls.count).toBe(0);
    });

    /** 카드 20장을 그리는 화면이 쿼리를 20번 쏘면 목록 렌더가 DB 왕복 20회가 된다. */
    it('행 수와 무관하게 쿼리는 1회다', async () => {
        const { db, calls } = stubDb([]);
        await new DrizzleContentTranslationRepository(db).findForEntity(
            TRANSLATABLE_ENTITY.news,
            ['a', 'b', 'c'],
            'ja'
        );
        expect(calls.count).toBe(1);
    });

    it('로케일별로 색인해 돌려준다', async () => {
        const { db } = stubDb([
            {
                entityId: 'n1',
                field: CONTENT_FIELD.news.title,
                locale: 'ja',
                value: '日本語タイトル',
                source: TRANSLATION_SOURCE.ai,
            },
            {
                entityId: 'n1',
                field: CONTENT_FIELD.news.title,
                locale: 'en',
                value: 'English title',
                source: TRANSLATION_SOURCE.ai,
            },
        ]);
        const result = await new DrizzleContentTranslationRepository(
            db
        ).findForEntity(TRANSLATABLE_ENTITY.news, ['n1'], 'ja');

        expect(result.byLocale('n1', CONTENT_FIELD.news.title)).toEqual({
            ja: '日本語タイトル',
            en: 'English title',
        });
    });

    /**
     * 어느 언어인지 모르는 문구를 아무 화면에나 붙이는 것보다, 그 행을 버리고
     * 폴백하는 편이 낫다(§toContentLocale).
     */
    it('알 수 없는 로케일 행은 버린다', async () => {
        const { db } = stubDb([
            {
                entityId: 'n1',
                field: CONTENT_FIELD.news.title,
                locale: 'kr',
                value: '잘못된 로케일',
                source: TRANSLATION_SOURCE.ai,
            },
        ]);
        const result = await new DrizzleContentTranslationRepository(
            db
        ).findForEntity(TRANSLATABLE_ENTITY.news, ['n1'], 'ko');

        expect(result.byLocale('n1', CONTENT_FIELD.news.title)).toEqual({});
    });

    /** 약관은 오역이 곧 의무의 변경이라 AI 번역을 그대로 내보낼 수 없다. */
    it('minimumSource=human이면 AI 번역 행을 제외한다', async () => {
        const { db } = stubDb([
            {
                entityId: 't1',
                field: CONTENT_FIELD.terms.body,
                locale: 'en',
                value: 'AI translated',
                source: TRANSLATION_SOURCE.ai,
            },
            {
                entityId: 't1',
                field: CONTENT_FIELD.terms.body,
                locale: 'ja',
                value: 'Human translated',
                source: TRANSLATION_SOURCE.human,
            },
        ]);
        const result = await new DrizzleContentTranslationRepository(
            db
        ).findForEntity(TRANSLATABLE_ENTITY.terms, ['t1'], 'ja');

        expect(
            result.byLocale(
                't1',
                CONTENT_FIELD.terms.body,
                TRANSLATION_SOURCE.human
            )
        ).toEqual({ ja: 'Human translated' });
    });

    it('알 수 없는 source는 ai로 본다 — 인간 번역으로 승격하지 않는다', async () => {
        const { db } = stubDb([
            {
                entityId: 't1',
                field: CONTENT_FIELD.terms.body,
                locale: 'ja',
                value: 'unknown source',
                source: 'machine',
            },
        ]);
        const result = await new DrizzleContentTranslationRepository(
            db
        ).findForEntity(TRANSLATABLE_ENTITY.terms, ['t1'], 'ja');

        expect(
            result.byLocale(
                't1',
                CONTENT_FIELD.terms.body,
                TRANSLATION_SOURCE.human
            )
        ).toEqual({});
    });
});

describe('ContentTranslations.resolve', () => {
    /** 원본 `*_ko` 컬럼은 백필 전 임시 소스다 — 파이프라인 결과가 최신이다. */
    it('사이드카가 레거시 컬럼을 이긴다', () => {
        const translations = new ContentTranslations(
            new Map([
                [
                    'n1',
                    new Map([
                        [
                            CONTENT_FIELD.news.title,
                            new Map([
                                [
                                    'ko' as const,
                                    {
                                        value: '새 번역',
                                        source: TRANSLATION_SOURCE.ai,
                                    },
                                ],
                            ]),
                        ],
                    ]),
                ],
            ])
        );

        expect(
            translations.resolve(
                'n1',
                CONTENT_FIELD.news.title,
                { ko: '옛 컬럼' },
                'ko'
            )?.value
        ).toBe('새 번역');
    });

    it('사이드카에 없으면 레거시 컬럼으로 해석한다', () => {
        expect(
            ContentTranslations.empty().resolve(
                'n1',
                CONTENT_FIELD.news.title,
                { ko: '옛 컬럼', en: 'Old column' },
                'en'
            )
        ).toEqual({
            value: 'Old column',
            locale: 'en',
            isFallback: false,
            fromSidecar: false,
        });
    });
});
