import { formatOperatingCashFlow } from '@/widgets/fundamental/utils/operatingCashFlow';

describe('formatOperatingCashFlow', () => {
    it('현금흐름이 없거나 값이 null이면 -이다', () => {
        expect(formatOperatingCashFlow(null, 'AAPL', 'en')).toBe('-');
        expect(
            formatOperatingCashFlow({ operatingCashFlow: null }, 'AAPL', 'en')
        ).toBe('-');
    });

    it('보고 통화가 없으면 상장 통화로 표기한다', () => {
        expect(
            formatOperatingCashFlow(
                { operatingCashFlow: 100_000_000_000 },
                'AAPL',
                'en'
            )
        ).toBe('$100B');
    });

    it('보고 통화가 있으면 그 통화로 표기한다 (TSM은 TWD로 공시)', () => {
        const out = formatOperatingCashFlow(
            { operatingCashFlow: 1_200_000_000_000, reportedCurrency: 'TWD' },
            'TSM',
            'en'
        );
        expect(out).toContain('TWD');
        expect(out).toContain('1.2T');
        expect(out).not.toContain('$');
    });

    it('공백뿐인 보고 통화는 없는 것으로 본다', () => {
        expect(
            formatOperatingCashFlow(
                { operatingCashFlow: 5_000_000_000, reportedCurrency: '  ' },
                'AAPL',
                'en'
            )
        ).toBe('$5B');
    });

    it('잘못된 보고 통화 코드는 상장 통화로 돌아간다', () => {
        expect(
            formatOperatingCashFlow(
                {
                    operatingCashFlow: 5_000_000_000,
                    reportedCurrency: 'NOT-A-CODE',
                },
                'AAPL',
                'en'
            )
        ).toBe('$5B');
    });
});
