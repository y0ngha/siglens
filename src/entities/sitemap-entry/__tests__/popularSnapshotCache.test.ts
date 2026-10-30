import {
    deserializePopularSitemapInputs,
    serializePopularSitemapInputs,
    type FreshSnapshotRow,
    type SerializedPopularSitemapInputs,
} from '../lib/popularSnapshotCache';

const AT = new Date('2026-10-03T02:00:00.000Z');

const row = (overrides: Partial<FreshSnapshotRow>): FreshSnapshotRow => ({
    symbol: 'AAPL',
    tab: 'technical',
    generatedAt: AT,
    hasProse: true,
    ...overrides,
});

describe('serializePopularSitemapInputs', () => {
    it('"SYMBOL:tab" 키와 ISO 시각 쌍으로 직렬화한다', () => {
        expect(
            serializePopularSitemapInputs([
                row({}),
                row({ symbol: 'BTC', tab: 'news' }),
            ])
        ).toEqual({
            snapshotGeneratedAt: [
                ['AAPL:technical', '2026-10-03T02:00:00.000Z'],
                ['BTC:news', '2026-10-03T02:00:00.000Z'],
            ],
        });
    });

    it('렌더 가능한 산문이 없는 행은 넣지 않는다', () => {
        expect(
            serializePopularSitemapInputs([row({ hasProse: false })])
        ).toEqual({ snapshotGeneratedAt: [] });
    });

    it('산문 게이트 대상이 아닌 탭은 넣지 않는다', () => {
        expect(
            serializePopularSitemapInputs([row({ tab: 'overall' })])
        ).toEqual({ snapshotGeneratedAt: [] });
    });
});

describe('deserializePopularSitemapInputs', () => {
    it('JSON 왕복 뒤에도 Map<string, Date>로 복원한다', () => {
        const serialized = serializePopularSitemapInputs([row({})]);
        const roundTripped: SerializedPopularSitemapInputs = JSON.parse(
            JSON.stringify(serialized)
        );
        const restored = deserializePopularSitemapInputs(roundTripped);

        expect(roundTripped).toEqual({
            snapshotGeneratedAt: [['AAPL:technical', AT.toISOString()]],
        });
        expect(restored.snapshotGeneratedAt?.get('AAPL:technical')).toEqual(AT);
    });
});
