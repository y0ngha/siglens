import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * [회귀] 이 클래스에는 테스트 파일이 아예 없었다 — `toFmpShape`의 `rawPayload`와
 * `getEarningsReport`의 2필드 투영에서 `symbol`과 `earningsDate`를 맞바꿔도
 * yahoo + fmp 스위트 458건이 전부 통과했다(감사 라운드 12).
 *
 * 두 값이 가는 곳이 다르다: `getEarningsReport`는 core의 `runFundamentalAnalysis`가
 * 그대로 받아 펀더멘털 AI 프롬프트에 싣고, `rawPayload`는 `earnings_reports`의
 * NOT NULL jsonb 컬럼으로 영속화된다.
 */
const { getYahooFundamentals } = vi.hoisted(() => ({
    getYahooFundamentals: vi.fn(),
}));
vi.mock('../yahooFundamentalSource', () => ({ getYahooFundamentals }));

const { YahooFundamentalProvider } =
    await import('../YahooFundamentalProvider');

const SYMBOL = '005930.KS';

/** 예정 실적 1건만 담은 최소 yahoo 응답. */
function fundamentalsWithUpcoming(options: { estimated: boolean }) {
    return {
        summary: {
            calendarEvents: {
                earnings: {
                    earningsDate: [new Date('2026-10-08T00:00:00Z')],
                    earningsAverage: 1234,
                    revenueAverage: 5678,
                    isEarningsDateEstimate: options.estimated,
                },
            },
        },
    };
}

describe('YahooFundamentalProvider — 실적 일정', () => {
    beforeEach(() => {
        getYahooFundamentals.mockReset();
    });

    it('getEarningsReport는 symbol과 earningsDate를 각자 자리에 넣는다', async () => {
        getYahooFundamentals.mockResolvedValue(
            fundamentalsWithUpcoming({ estimated: false })
        );

        const report = await new YahooFundamentalProvider().getEarningsReport(
            SYMBOL
        );

        expect(report).toEqual({
            symbol: SYMBOL,
            earningsDate: '2026-10-08',
        });
    });

    it('rawPayload에 symbol·earningsDate를 싣고, 추정일이면 isEstimate를 붙인다', async () => {
        getYahooFundamentals.mockResolvedValue(
            fundamentalsWithUpcoming({ estimated: true })
        );

        const [item] = await new YahooFundamentalProvider().getEarningsReports(
            SYMBOL
        );

        expect(item!.rawPayload).toEqual({
            symbol: SYMBOL,
            earningsDate: '2026-10-08',
            isEstimate: true,
        });
    });

    it('확정 공시일이면 isEstimate를 붙이지 않는다', async () => {
        // 추정일을 확정처럼 렌더하면 안 된다 — 상위가 이 필드로 구분한다.
        getYahooFundamentals.mockResolvedValue(
            fundamentalsWithUpcoming({ estimated: false })
        );

        const [item] = await new YahooFundamentalProvider().getEarningsReports(
            SYMBOL
        );

        expect(item!.rawPayload).not.toHaveProperty('isEstimate');
    });
});
