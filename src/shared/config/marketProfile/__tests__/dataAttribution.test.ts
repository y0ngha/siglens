import { DATA_ATTRIBUTION } from '../dataAttribution';
import { CRYPTO_DESCRIPTOR } from '../crypto';
import { KR_EQUITY_DESCRIPTOR } from '../krEquity';
import { US_EQUITY_DESCRIPTOR } from '../usEquity';

const PROFILES = [
    ['us-equity', US_EQUITY_DESCRIPTOR],
    ['crypto', CRYPTO_DESCRIPTOR],
    ['kr-equity', KR_EQUITY_DESCRIPTOR],
] as const;

describe('DATA_ATTRIBUTION', () => {
    it('FMP만 출처 표기가 있고 Yahoo는 없다', () => {
        expect(DATA_ATTRIBUTION.fmp).toEqual({
            text: 'Data provided by Financial Modeling Prep',
            url: 'https://financialmodelingprep.com',
        });
        expect(DATA_ATTRIBUTION.yahoo).toBeNull();
    });

    it('링크에 제휴·ref 파라미터가 없다', () => {
        const url = new URL(DATA_ATTRIBUTION.fmp!.url);
        expect(url.search).toBe('');
        expect(url.hash).toBe('');
    });

    it.each(PROFILES)(
        '%s: 표기는 프로필이 실제로 쓰는 dataProvider와 짝이다(어댑터를 바꾸면 표기도 따라야 한다)',
        (_id, descriptor) => {
            const attribution = DATA_ATTRIBUTION[descriptor.dataProvider];
            if (descriptor.dataProvider === 'fmp') {
                expect(attribution?.text).toContain('Financial Modeling Prep');
            } else {
                expect(attribution).toBeNull();
            }
        }
    );

    it('미국 주식·암호화폐는 FMP(표기 있음), 한국 주식은 Yahoo(표기 없음)다', () => {
        expect(
            DATA_ATTRIBUTION[US_EQUITY_DESCRIPTOR.dataProvider]
        ).not.toBeNull();
        expect(DATA_ATTRIBUTION[CRYPTO_DESCRIPTOR.dataProvider]).not.toBeNull();
        expect(DATA_ATTRIBUTION[KR_EQUITY_DESCRIPTOR.dataProvider]).toBeNull();
    });
});
