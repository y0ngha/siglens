import type { TickerSearchResult } from '@/shared/lib/types';
import { preferPrimaryListing } from '../preferPrimaryListing';

function row(
    symbol: string,
    overrides: Partial<TickerSearchResult> = {}
): TickerSearchResult {
    return {
        symbol,
        name: symbol,
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
        ...overrides,
    };
}

const krx = row('005930.KS', {
    name: 'Samsung Electronics Co., Ltd.',
    koreanName: '삼성전자',
    exchange: 'KSC',
    exchangeFullName: 'KOSPI',
});
const otc = row('SSNLF', {
    name: 'Samsung Electronics Co. Ltd',
    koreanName: '삼성전자',
    exchange: 'OTC',
    exchangeFullName: 'Other OTC',
});

describe('preferPrimaryListing', () => {
    it('KRX 행이 없으면 입력을 그대로 돌려준다', () => {
        const input = [otc, row('AAPL')];

        expect(preferPrimaryListing(input)).toBe(input);
    });

    it('짝이 되는 OTC 행을 KRX 행 바로 뒤로 옮긴다', () => {
        const aapl = row('AAPL');

        expect(
            preferPrimaryListing([aapl, otc, krx]).map(r => r.symbol)
        ).toEqual(['AAPL', '005930.KS', 'SSNLF']);
    });

    it('한글명이 없어도 구두점을 지운 영문명이 같으면 짝으로 본다', () => {
        const otcNoKo = { ...otc, koreanName: undefined };
        const krxNoKo = { ...krx, koreanName: undefined };

        expect(
            preferPrimaryListing([otcNoKo, krxNoKo]).map(r => r.symbol)
        ).toEqual(['005930.KS', 'SSNLF']);
    });

    it('짝이 되는 KRX 상장이 없는 OTC 행은 순서를 건드리지 않는다', () => {
        const otherKrx = row('000660.KS', {
            name: 'SK hynix',
            koreanName: 'SK하이닉스',
            exchangeFullName: 'KOSPI',
        });
        const input = [otc, otherKrx];

        expect(preferPrimaryListing(input)).toBe(input);
    });

    it('OTC가 아닌 비KRX 행은 이름이 같아도 옮기지 않는다', () => {
        const nasdaq = { ...otc, exchangeFullName: 'NASDAQ' };

        expect(preferPrimaryListing([nasdaq, krx]).map(r => r.symbol)).toEqual([
            'SSNLF',
            '005930.KS',
        ]);
    });
});
