import {
    buildTranslationIndex,
    ContentTranslations,
} from '@/shared/db/contentTranslations';
import {
    CONTENT_FIELD,
    TRANSLATION_SOURCE,
} from '@/shared/db/contentTranslationFields';

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

describe('buildTranslationIndex', () => {
    it('같은 (행, 필드)의 로케일들을 한 칸 아래로 묶는다', () => {
        const translations = buildTranslationIndex([
            {
                entityId: 'n1',
                field: CONTENT_FIELD.news.title,
                locale: 'ja',
                value: '日本語',
                source: TRANSLATION_SOURCE.ai,
            },
            {
                entityId: 'n1',
                field: CONTENT_FIELD.news.title,
                locale: 'en',
                value: 'English',
                source: TRANSLATION_SOURCE.human,
            },
            {
                entityId: 'n1',
                field: CONTENT_FIELD.news.body,
                locale: 'en',
                value: 'Body',
                source: TRANSLATION_SOURCE.ai,
            },
        ]);

        expect(translations.byLocale('n1', CONTENT_FIELD.news.title)).toEqual({
            ja: '日本語',
            en: 'English',
        });
        expect(translations.byLocale('n1', CONTENT_FIELD.news.body)).toEqual({
            en: 'Body',
        });
    });

    it('알 수 없는 로케일 행은 버린다', () => {
        const translations = buildTranslationIndex([
            {
                entityId: 'n1',
                field: CONTENT_FIELD.news.title,
                locale: 'kr',
                value: '잘못된 로케일',
                source: TRANSLATION_SOURCE.ai,
            },
        ]);

        expect(translations.byLocale('n1', CONTENT_FIELD.news.title)).toEqual(
            {}
        );
    });

    it('알 수 없는 source는 ai로 본다', () => {
        const translations = buildTranslationIndex([
            {
                entityId: 't1',
                field: CONTENT_FIELD.terms.body,
                locale: 'ja',
                value: 'x',
                source: 'machine',
            },
        ]);

        expect(
            translations.byLocale(
                't1',
                CONTENT_FIELD.terms.body,
                TRANSLATION_SOURCE.human
            )
        ).toEqual({});
    });
});
