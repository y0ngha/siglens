import { afterEach, beforeEach } from 'vitest';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
    TRANSLATION_SOURCE,
} from '@/shared/db/contentTranslationFields';

const ORIGINAL = process.env.DB_CONTENT_LOCALE;

interface Row {
    id: string;
    titleKo: string | null;
    titleEn: string;
}

const ROWS: Row[] = [
    { id: 'n1', titleKo: '한국어 제목', titleEn: 'English title' },
    { id: 'n2', titleKo: null, titleEn: 'Only English' },
];

const FIELDS = {
    title: {
        field: CONTENT_FIELD.news.title,
        legacy: (row: Row) => ({ ko: row.titleKo, en: row.titleEn }),
    },
};

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DB_CONTENT_LOCALE;
    else process.env.DB_CONTENT_LOCALE = ORIGINAL;
    vi.resetModules();
    vi.doUnmock('@/shared/db/contentTranslationClient');
});

beforeEach(() => {
    vi.resetModules();
});

describe('localizeContent — 스위치 OFF (마이그레이션 전)', () => {
    /**
     * 코드가 스키마보다 먼저 배포될 수 있다. 그 사이 사이드카를 조회하면
     * `relation "content_translations" does not exist`로 읽기 경로가 죽는다.
     */
    it('사이드카를 조회하지 않고 레거시 컬럼만으로 해석한다', async () => {
        delete process.env.DB_CONTENT_LOCALE;
        const { localizeContent } = await import('@/shared/db/localizeContent');

        const result = await localizeContent({
            entity: TRANSLATABLE_ENTITY.news,
            rows: ROWS,
            locale: 'ja',
            id: row => row.id,
            fields: FIELDS,
        });

        // ja 번역이 없으니 체인상 en으로 폴백한다.
        expect(result[0]!.localized.title).toEqual({
            value: 'English title',
            locale: 'en',
            isFallback: true,
            // 레거시 `title_en` 컬럼에서 왔다 — 사이드카가 아니다.
            fromSidecar: false,
        });
    });

    it('원본 행을 그대로 보존한다 — 기존 소비자가 깨지지 않는다', async () => {
        delete process.env.DB_CONTENT_LOCALE;
        const { localizeContent } = await import('@/shared/db/localizeContent');

        const [first] = await localizeContent({
            entity: TRANSLATABLE_ENTITY.news,
            rows: ROWS,
            locale: 'ko',
            id: row => row.id,
            fields: FIELDS,
        });

        expect(first).toMatchObject({ id: 'n1', titleKo: '한국어 제목' });
    });
});

describe('localizeContent — 스위치 ON', () => {
    async function withSidecar(
        cells: Array<{ id: string; locale: string; value: string }>
    ) {
        vi.doMock('@/shared/db/contentTranslationClient', () => ({
            isContentLocaleEnabled: () => true,
            getContentTranslationRepository: () => ({
                findForEntity: async () => {
                    const { ContentTranslations } =
                        await import('@/shared/db/contentTranslationRepository');
                    const index = new Map();
                    for (const cell of cells) {
                        const byField = index.get(cell.id) ?? new Map();
                        const byLocale =
                            byField.get(CONTENT_FIELD.news.title) ?? new Map();
                        byLocale.set(cell.locale, {
                            value: cell.value,
                            source: TRANSLATION_SOURCE.ai,
                        });
                        byField.set(CONTENT_FIELD.news.title, byLocale);
                        index.set(cell.id, byField);
                    }
                    return new ContentTranslations(index);
                },
            }),
        }));
        return import('@/shared/db/localizeContent');
    }

    it('사이드카 번역이 레거시 컬럼을 이긴다', async () => {
        const { localizeContent } = await withSidecar([
            { id: 'n1', locale: 'ja', value: '日本語タイトル' },
        ]);

        const result = await localizeContent({
            entity: TRANSLATABLE_ENTITY.news,
            rows: ROWS,
            locale: 'ja',
            id: row => row.id,
            fields: FIELDS,
        });

        expect(result[0]!.localized.title).toEqual({
            value: '日本語タイトル',
            locale: 'ja',
            isFallback: false,
            fromSidecar: true,
        });
    });

    it('번역이 없는 행은 여전히 레거시로 폴백한다', async () => {
        const { localizeContent } = await withSidecar([
            { id: 'n1', locale: 'ja', value: '日本語タイトル' },
        ]);

        const result = await localizeContent({
            entity: TRANSLATABLE_ENTITY.news,
            rows: ROWS,
            locale: 'ja',
            id: row => row.id,
            fields: FIELDS,
        });

        expect(result[1]!.localized.title?.value).toBe('Only English');
        expect(result[1]!.localized.title?.isFallback).toBe(true);
    });
});
