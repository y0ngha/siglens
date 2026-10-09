import { mapGuideRows, type GuideRow } from '../mapGuideRows';

function row(overrides: Partial<GuideRow> = {}): GuideRow {
    return {
        slug: 'rsi',
        category: 'indicators',
        sortOrder: 270,
        related: ['macd'],
        locale: 'ko',
        title: 'RSI',
        aliases: ['상대강도지수'],
        summary: '요약',
        seoTitle: 'RSI 뜻',
        seoDescription: '설명',
        demoCaption: null,
        bodyMd: '## 본문',
        faq: [{ q: '질문', a: '답' }],
        entryUpdatedAt: new Date('2026-10-01T00:00:00Z'),
        contentUpdatedAt: new Date('2026-10-02T00:00:00Z'),
        ...overrides,
    };
}

describe('mapGuideRows', () => {
    it('요청 로케일 행이 있으면 그것을 쓰고 폴백이 아니다', () => {
        const catalog = mapGuideRows(
            [
                row({ locale: 'ko', title: '알에스아이' }),
                row({ locale: 'en', title: 'RSI guide' }),
            ],
            'en'
        );
        expect(catalog.entries).toHaveLength(1);
        expect(catalog.entries[0]).toMatchObject({
            title: 'RSI guide',
            isFallback: false,
        });
    });

    it('번역 행이 없으면 ko로 채우고 폴백으로 표시한다', () => {
        const catalog = mapGuideRows([row({ locale: 'ko' })], 'ja');
        expect(catalog.entries[0]).toMatchObject({
            title: 'RSI',
            isFallback: true,
        });
    });

    it('ko 요청은 폴백이 아니다', () => {
        const catalog = mapGuideRows([row()], 'ko');
        expect(catalog.entries[0]!.isFallback).toBe(false);
    });

    it('요청도 ko도 아닌 로케일 행은 무시한다', () => {
        const catalog = mapGuideRows([row({ locale: 'zh' })], 'en');
        expect(catalog.entries).toEqual([]);
    });

    it('알 수 없는 카테고리 행은 버린다', () => {
        const catalog = mapGuideRows([row({ category: 'unknown' })], 'ko');
        expect(catalog.entries).toEqual([]);
    });

    it('updatedAt은 항목과 본문 중 늦은 쪽을 ISO로 낸다', () => {
        const catalog = mapGuideRows([row()], 'ko');
        expect(catalog.entries[0]!.updatedAt).toBe('2026-10-02T00:00:00.000Z');
    });

    it('항목이 더 늦게 바뀌었으면 항목 시각을 쓴다', () => {
        const catalog = mapGuideRows(
            [row({ entryUpdatedAt: new Date('2026-11-01T00:00:00Z') })],
            'ko'
        );
        expect(catalog.entries[0]!.updatedAt).toBe('2026-11-01T00:00:00.000Z');
    });

    it('모양이 틀린 faq 원소는 건너뛴다', () => {
        const catalog = mapGuideRows(
            [row({ faq: [{ q: '질문', a: '답' }, { q: 1 }, null, 'x'] })],
            'ko'
        );
        expect(catalog.entries[0]!.faq).toEqual([{ q: '질문', a: '답' }]);
    });

    it('faq가 배열이 아니면 빈 배열이다', () => {
        const catalog = mapGuideRows([row({ faq: { q: 'x' } })], 'ko');
        expect(catalog.entries[0]!.faq).toEqual([]);
    });

    it('카테고리 순서 → order → slug 순으로 정렬한다', () => {
        const catalog = mapGuideRows(
            [
                row({
                    slug: 'z-strategy',
                    category: 'strategies',
                    sortOrder: 1,
                }),
                row({ slug: 'b-ind', category: 'indicators', sortOrder: 20 }),
                row({ slug: 'a-ind', category: 'indicators', sortOrder: 20 }),
                row({ slug: 'doji', category: 'candlesticks', sortOrder: 99 }),
            ],
            'ko'
        );
        expect(catalog.entries.map(e => e.slug)).toEqual([
            'doji',
            'a-ind',
            'b-ind',
            'z-strategy',
        ]);
    });
});
