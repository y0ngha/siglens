// vi.mock → imports 순서 (MISTAKES.md Tests §17)

/** 사이드카 상태 — `@/shared/test-utils/contentTranslationSidecar` 참고. */
const sidecar = vi.hoisted((): SidecarState => ({ cells: null }));

vi.mock('@/shared/db/contentTranslationClient', async importOriginal => {
    const { sidecarAwareClient } =
        await import('@/shared/test-utils/contentTranslationSidecar');
    return sidecarAwareClient(
        await importOriginal<
            typeof import('@/shared/db/contentTranslationClient')
        >(),
        sidecar
    );
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
} from '@/shared/db/contentTranslationFields';
import type { NewsCardDbRow } from '@/shared/lib/news/toLocalizedDisplayItems';
import { toLocalizedDisplayItems } from '@/shared/lib/news/toLocalizedDisplayItems';
import type {
    SidecarCell,
    SidecarState,
} from '@/shared/test-utils/contentTranslationSidecar';

const ORIGINAL = process.env.DB_CONTENT_LOCALE;

const ROW: NewsCardDbRow = {
    id: 'n1',
    source: 'FMP',
    url: 'https://example.com/a',
    publishedAt: new Date('2026-08-20T00:00:00Z'),
    titleEn: 'English title',
    titleKo: '한국어 제목',
    bodyKo: '한국어 본문',
    summaryKo: '한국어 요약',
    sentiment: 'bullish',
    category: 'earnings',
    priceImpact: 'high',
};

beforeEach(() => {
    delete process.env.DB_CONTENT_LOCALE;
});

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DB_CONTENT_LOCALE;
    else process.env.DB_CONTENT_LOCALE = ORIGINAL;
    sidecar.cells = null;
});

describe('toLocalizedDisplayItems', () => {
    it('DB enum 값을 좁혀서 돌려준다', async () => {
        const [item] = await toLocalizedDisplayItems(
            [ROW],
            'ko',
            TRANSLATABLE_ENTITY.news
        );

        expect(item).toMatchObject({
            sentiment: 'bullish',
            category: 'earnings',
            priceImpact: 'high',
        });
    });

    it('알 수 없는 enum 값은 null로 떨어뜨린다', async () => {
        const [item] = await toLocalizedDisplayItems(
            [{ ...ROW, sentiment: 'sideways' }],
            'ko',
            TRANSLATABLE_ENTITY.news
        );

        expect(item!.sentiment).toBeNull();
    });

    /**
     * 해석값이 원본과 같으면 붙이지 않는다. 붙이면 목록 20건 × 3필드만큼 ISR
     * 블롭과 RSC 페이로드가 두 배가 된다 — 이 레포는 RSC 페이로드를 실제로
     * 줄여 온 이력이 있다.
     */
    it('ko에서는 원본과 같은 값을 중복해 싣지 않는다', async () => {
        const [item] = await toLocalizedDisplayItems(
            [ROW],
            'ko',
            TRANSLATABLE_ENTITY.news
        );

        expect(item).not.toHaveProperty('titleLocalized');
        expect(item).not.toHaveProperty('summaryLocalized');
        expect(item).not.toHaveProperty('bodyLocalized');
    });

    /**
     * **스위치 OFF에서는 결과가 로케일과 무관해야 한다.**
     *
     * 이 행들은 `unstable_cache` 블롭에 그대로 굳는데, 스위치가 꺼져 있으면
     * `contentLocaleKeyPart`가 캐시 키에 로케일을 넣지 않는다. 결과가 로케일별로
     * 갈리면 **먼저 생성된 로케일의 헤드라인이 네 로케일 전부에 굳는다** —
     * 영어가 먼저 warm되면 색인된 한국어 뉴스 페이지에 영어 헤드라인이 박힌다
     * (SEO 감사 라운드 1 S1).
     *
     * 예전에는 `title_en` 레거시 컬럼이 이 함수 안에서 로케일 분기를 만들어
     * 이 불변식이 깨져 있었다. 레거시 ko/en 분기는 캐시 **뒤**
     * `resolveNewsTitle`이 처리한다.
     */
    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '스위치 OFF: %s 결과가 ko와 바이트 단위로 같다',
        async locale => {
            const [base] = await toLocalizedDisplayItems(
                [ROW],
                'ko',
                TRANSLATABLE_ENTITY.news
            );
            const [item] = await toLocalizedDisplayItems(
                [ROW],
                locale,
                TRANSLATABLE_ENTITY.news
            );

            expect(JSON.stringify(item)).toBe(JSON.stringify(base));
        }
    );

    /**
     * **스위치 ON에서는 사이드카 값만 붙는다.**
     *
     * 이 파일 전체가 스위치 OFF로만 돌고 있었다 — `fromSidecar` 게이트는
     * 캐시 교차 오염을 막는 유일한 장치인데 테스트가 하나도 없었다. 감사가
     * 잡았다.
     */
    describe('스위치 ON', () => {
        /** `ROW`의 사이드카 번역을 깐다. */
        function withSidecar(
            cells: ReadonlyArray<Omit<SidecarCell, 'id'>>
        ): void {
            sidecar.cells = cells.map(cell => ({ ...cell, id: ROW.id }));
        }

        it('사이드카 번역은 세 필드 모두 붙는다', async () => {
            withSidecar([
                {
                    field: CONTENT_FIELD.news.title,
                    locale: 'ja',
                    value: '日本語見出し',
                },
                {
                    field: CONTENT_FIELD.news.summary,
                    locale: 'ja',
                    value: '日本語要約',
                },
                {
                    field: CONTENT_FIELD.news.body,
                    locale: 'ja',
                    value: '日本語本文',
                },
            ]);
            const [item] = await toLocalizedDisplayItems(
                [ROW],
                'ja',
                TRANSLATABLE_ENTITY.news
            );

            expect(item).toMatchObject({
                titleLocalized: '日本語見出し',
                summaryLocalized: '日本語要約',
                bodyLocalized: '日本語本文',
            });
        });

        /**
         * 사이드카에 `ja`가 없어 `en` 레거시 컬럼으로 폴백한 값은 **붙이면 안
         * 된다**. 붙이면 캐시 행이 로케일에 의존하게 되는데, 뉴스 캐시 키의
         * 로케일 조각은 스위치가 켜진 뒤에야 생기므로 켜기 직전 warm된 블롭이
         * 오염된 채 TTL까지 남는다.
         */
        it('사이드카에 없어 폴백한 값은 붙이지 않는다', async () => {
            withSidecar([
                {
                    field: CONTENT_FIELD.news.title,
                    locale: 'zh',
                    value: '中文标题',
                },
            ]);
            const [item] = await toLocalizedDisplayItems(
                [ROW],
                'ja',
                TRANSLATABLE_ENTITY.news
            );

            // ja 체인은 ja→en→ko. 사이드카엔 zh뿐이라 레거시 title_en이 이긴다.
            expect(item).not.toHaveProperty('titleLocalized');
            expect(item!.titleEn).toBe('English title');
        });
    });

    /** 레거시 컬럼만으로 갈리는 값은 붙지 않는다 — 캐시 불변식(위) 때문이다. */
    it('en에서도 레거시 title_en은 해석값으로 붙지 않는다', async () => {
        const [item] = await toLocalizedDisplayItems(
            [ROW],
            'en',
            TRANSLATABLE_ENTITY.news
        );

        expect(item).not.toHaveProperty('titleLocalized');
        // 원본 컬럼은 그대로 실린다 — 렌더 시점 `resolveNewsTitle`이 쓴다.
        expect(item!.titleEn).toBe('English title');
    });
});
