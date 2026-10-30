import { buildPeerRows } from '@/widgets/fundamental/utils/peerRows';

describe('buildPeerRows', () => {
    it('큐레이션 종목만 linkable이다', () => {
        const rows = buildPeerRows([
            { symbol: 'AAPL', companyName: 'Apple', marketCap: 3 },
            { symbol: 'ZZZZNOTCURATED', companyName: 'Obscure', marketCap: 1 },
        ]);

        expect(rows.map(r => [r.symbol, r.linkable])).toEqual([
            ['AAPL', true],
            ['ZZZZNOTCURATED', false],
        ]);
    });

    it('회사명과 시가총액을 그대로 싣고 순서를 유지한다', () => {
        const rows = buildPeerRows([
            { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 5 },
            { symbol: 'AAPL', companyName: 'Apple', marketCap: 3 },
        ]);

        expect(rows).toEqual([
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                marketCap: 5,
                linkable: true,
            },
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                marketCap: 3,
                linkable: true,
            },
        ]);
    });

    it('빈 목록은 빈 배열이다', () => {
        expect(buildPeerRows([])).toEqual([]);
    });
});
