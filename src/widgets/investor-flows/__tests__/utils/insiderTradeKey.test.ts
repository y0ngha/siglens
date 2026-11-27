import { describe, expect, it } from 'vitest';
import { makeTransaction } from '@/entities/investor-flows/__tests__/fixtures/flowsFixtures';
import { insiderTradeKey } from '../../utils/insiderTradeKey';

describe('insiderTradeKey', () => {
    it('날짜·이름·수량·원문 주소를 이어 붙인다', () => {
        expect(
            insiderTradeKey(
                makeTransaction({
                    date: '2026-10-01',
                    name: 'Fixture Director A',
                    shares: 1000,
                    url: 'https://www.sec.gov/Archives/a.htm',
                })
            )
        ).toBe(
            '2026-10-01-Fixture Director A-1000-https://www.sec.gov/Archives/a.htm'
        );
    });

    it('날짜·이름·수량이 같아도 원문 주소가 다르면 키가 다르다', () => {
        const base = {
            date: '2026-10-01',
            name: 'Fixture Director A',
            shares: 1000,
        };
        expect(
            insiderTradeKey(makeTransaction({ ...base, url: 'https://x/a' }))
        ).not.toBe(
            insiderTradeKey(makeTransaction({ ...base, url: 'https://x/b' }))
        );
    });
});
