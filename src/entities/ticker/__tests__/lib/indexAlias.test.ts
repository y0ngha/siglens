import { resolveIndexAlias } from '../../lib/indexAlias';

describe('resolveIndexAlias', () => {
    it('VIX는 대시보드와 같은 FMP 지수 심볼 ^VIX로 해석한다', () => {
        expect(resolveIndexAlias('VIX')).toEqual({
            symbol: 'VIX',
            name: 'VIX',
            koreanName: '공포지수',
            fmpSymbol: '^VIX',
        });
    });

    it('대시보드의 다른 미국 지수도 ^ 심볼로 해석한다', () => {
        expect(resolveIndexAlias('GSPC')?.fmpSymbol).toBe('^GSPC');
        expect(resolveIndexAlias('DJI')?.fmpSymbol).toBe('^DJI');
        expect(resolveIndexAlias('IXIC')?.fmpSymbol).toBe('^IXIC');
    });

    it('지수가 아닌 심볼(접두가 같은 ETF 포함)은 null', () => {
        expect(resolveIndexAlias('VIXM')).toBeNull();
        expect(resolveIndexAlias('AAPL')).toBeNull();
    });

    it('반환값을 고쳐도 다음 호출에 새지 않는다', () => {
        const first = resolveIndexAlias('VIX')!;
        first.name = 'mutated';
        expect(resolveIndexAlias('VIX')?.name).toBe('VIX');
    });
});
