import { validateWatchlistSymbol } from '@/entities/watchlist/lib/validateWatchlistSymbol';

describe('validateWatchlistSymbol', () => {
    it('공백을 지우고 대문자 정규형으로 돌려준다', () => {
        expect(validateWatchlistSymbol('  aapl ')).toEqual({
            ok: true,
            symbol: 'AAPL',
        });
    });

    it('한국 종목 접미사를 받는다', () => {
        expect(validateWatchlistSymbol('005930.ks')).toEqual({
            ok: true,
            symbol: '005930.KS',
        });
    });

    it.each(['', '   ', 'AA PL', 'HVO.L', '<script>'])(
        '%j 는 invalid_symbol',
        raw => {
            expect(validateWatchlistSymbol(raw)).toEqual({
                ok: false,
                code: 'invalid_symbol',
            });
        }
    );
});
