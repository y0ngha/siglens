import { describe, expect, it } from 'vitest';
import { toView } from '../toView';

describe('toView', () => {
    describe('보유 레코드가 주어지면', () => {
        it('레코드를 뷰로 바꾸며 수량·평단 문자열은 그대로, 시각은 ISO 문자열로 직렬화한다', () => {
            expect(
                toView({
                    id: 'h1',
                    userId: 'user-1',
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    fmpSymbol: 'AAPL',
                    quantity: '10.12345678',
                    averagePrice: '150.50',
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-01-02T03:04:05.000Z'),
                })
            ).toEqual({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                fmpSymbol: 'AAPL',
                quantity: '10.12345678',
                averagePrice: '150.50',
                updatedAt: '2026-01-02T03:04:05.000Z',
            });
        });
    });
});
