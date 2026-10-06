// vi.mock → imports 순서 (MISTAKES.md Tests §17)

type SidecarCell = { id: string; locale: string; value: string };

/**
 * 사이드카 상태. `null`이면 **실물** `contentTranslationClient`를 그대로 탄다
 * (스위치 OFF 경로를 대역 없이 검증), 배열이면 그 셀만 가진 리포지터리를 돌려준다.
 *
 * 예전엔 케이스마다 `vi.resetModules()` + `vi.doMock` 뒤 `localizeContent`를 다시
 * import했다. 그때마다 DB 스키마·drizzle 그래프가 새로 평가돼 병렬 부하에서 기본
 * 5초를 넘겼다. 파일 단위 mock 하나가 상태를 읽게 하면 모듈은 한 번만 적재된다.
 */
const sidecar = vi.hoisted(() => ({ cells: null as SidecarCell[] | null }));

vi.mock('@/shared/db/contentTranslationClient', async importOriginal => {
    const real =
        await importOriginal<
            typeof import('@/shared/db/contentTranslationClient')
        >();
    const { ContentTranslations } =
        await import('@/shared/db/contentTranslationRepository');
    // 팩토리는 import보다 먼저 끌어올려지므로 파일 상단 import를 쓸 수 없다.
    const { CONTENT_FIELD: FIELD, TRANSLATION_SOURCE: SOURCE } =
        await import('@/shared/db/contentTranslationFields');

    function sidecarRepository(cells: SidecarCell[]) {
        return {
            findForEntity: async () => {
                const index = new Map();
                for (const cell of cells) {
                    const byField = index.get(cell.id) ?? new Map();
                    const byLocale = byField.get(FIELD.news.title) ?? new Map();
                    byLocale.set(cell.locale, {
                        value: cell.value,
                        source: SOURCE.ai,
                    });
                    byField.set(FIELD.news.title, byLocale);
                    index.set(cell.id, byField);
                }
                return new ContentTranslations(index);
            },
        };
    }

    return {
        ...real,
        isContentLocaleEnabled: () =>
            sidecar.cells === null ? real.isContentLocaleEnabled() : true,
        getContentTranslationRepository: () =>
            sidecar.cells === null
                ? real.getContentTranslationRepository()
                : sidecarRepository(sidecar.cells),
    };
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
} from '@/shared/db/contentTranslationFields';
import { localizeContent } from '@/shared/db/localizeContent';

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
    sidecar.cells = null;
});

describe('localizeContent — 스위치 OFF (마이그레이션 전)', () => {
    /**
     * 코드가 스키마보다 먼저 배포될 수 있다. 그 사이 사이드카를 조회하면
     * `relation "content_translations" does not exist`로 읽기 경로가 죽는다.
     */
    it('사이드카를 조회하지 않고 레거시 컬럼만으로 해석한다', async () => {
        delete process.env.DB_CONTENT_LOCALE;

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
    function withSidecar(cells: SidecarCell[]): void {
        sidecar.cells = cells;
    }

    it('사이드카 번역이 레거시 컬럼을 이긴다', async () => {
        withSidecar([{ id: 'n1', locale: 'ja', value: '日本語タイトル' }]);

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
        withSidecar([{ id: 'n1', locale: 'ja', value: '日本語タイトル' }]);

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
