import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { FundamentalFact } from '@/entities/fundamental-facts/model';
import { formatCurrencyForSymbol } from '@/shared/lib/priceFormat';
import { formatFactSignedPercent } from '@/widgets/fundamental/utils/factsFormat';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { FundamentalFactsCard } from '../../sections/FundamentalFactsCard';

const ALL_FACTS: FundamentalFact[] = [
    {
        kind: 'cashRunway',
        cash: 482_280_000,
        annualBurn: 43_110_000,
        years: 11.19,
        reportedCurrency: 'USD',
        asOf: '2025-12-31',
    },
    {
        kind: 'dilutionFilings',
        filings: 2,
        atmFilings: 1,
        shelfFilings: 1,
        windowDays: 180,
        latestFilingDate: '2026-10-01',
    },
    {
        kind: 'insiderTrades',
        buyCount: 0,
        sellCount: 3,
        buyValueUsd: 0,
        sellValueUsd: 170_294,
        windowDays: 90,
    },
    {
        kind: 'shortInterest',
        pctFloat: 12.4,
        daysToCover: 2.03,
        settlementDate: '2026-10-15',
    },
    {
        kind: 'priceTarget',
        consensus: 5.875,
        low: 3.75,
        high: 8,
        buy: 2,
        hold: 0,
        sell: 0,
        stale: true,
    },
    {
        kind: 'epsStreak',
        direction: 'miss',
        count: 2,
        latestDate: '2026-09-11',
    },
    {
        kind: 'nextEarnings',
        date: '2026-11-20',
        daysUntil: 13,
        lastSurprisePct: -30,
        lastDate: '2026-09-11',
    },
];

describe('FundamentalFactsCard', () => {
    it('사실이 없으면 아무것도 그리지 않는다', () => {
        const { container } = renderWithIntl(
            <FundamentalFactsCard
                facts={[]}
                symbol="LAES"
                displayName="SEALSQ"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('ko: 사실마다 문장과 출처를 그린다', () => {
        renderWithIntl(
            <FundamentalFactsCard
                facts={ALL_FACTS}
                symbol="LAES"
                displayName="SEALSQ"
            />
        );

        expect(
            screen.getByRole('heading', { name: 'SEALSQ 재무·수급 요약' })
        ).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(ALL_FACTS.length);
        expect(screen.getByText(/약 11\.2년치 규모입니다/)).toBeInTheDocument();
        expect(
            screen.getByText('2025년 12월 31일 연간 재무제표 기준')
        ).toBeInTheDocument();
        expect(
            screen.getByText(/증자 관련 SEC 공시가 2건 있었습니다/)
        ).toBeInTheDocument();
        expect(screen.getByText(/매도 3건/)).toBeInTheDocument();
        expect(
            screen.getByText(
                '공매도 잔고는 유통주식의 12.4%이고, 하루 평균 거래량으로 다 갚는 데 2.0일이 걸리는 규모입니다.'
            )
        ).toBeInTheDocument();
        const usd = (v: number) => formatCurrencyForSymbol(v, 'LAES', 'ko');
        expect(
            screen.getByText(
                `애널리스트 평균 목표가는 ${usd(5.875)}이고, 범위는 ${usd(3.75)}~${usd(8)}입니다.`
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('최근 3개월 동안 새로 나온 목표가는 없습니다.')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '최근 2번 연속으로 EPS가 시장 예상치를 밑돌았습니다.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '다음 실적 발표 예정일은 2026년 11월 20일이고, 13일 남았습니다.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                `직전 발표(2026년 9월 11일)의 EPS는 예상치 대비 ${formatFactSignedPercent(-30, 'ko')}였습니다.`
            )
        ).toBeInTheDocument();
    });

    it('목표가 범위가 없으면 범위 없는 문장, 의견 0건이면 의견 문장을 뺀다', () => {
        renderWithIntl(
            <FundamentalFactsCard
                facts={[
                    {
                        kind: 'priceTarget',
                        consensus: 10,
                        low: null,
                        high: null,
                        buy: 0,
                        hold: 0,
                        sell: 0,
                        stale: false,
                    },
                ]}
                symbol="AAPL"
                displayName="애플"
            />
        );
        expect(
            screen.getByText(
                `애널리스트 평균 목표가는 ${formatCurrencyForSymbol(10, 'AAPL', 'ko')}입니다.`
            )
        ).toBeInTheDocument();
        expect(screen.queryByText(/투자의견은/)).toBeNull();
    });

    it('공매도 값이 하나만 있으면 그 값만 말한다', () => {
        renderWithIntl(
            <FundamentalFactsCard
                facts={[
                    {
                        kind: 'shortInterest',
                        pctFloat: null,
                        daysToCover: 6.1,
                        settlementDate: null,
                    },
                ]}
                symbol="AAPL"
                displayName="애플"
            />
        );
        expect(
            screen.getByText(
                '공매도 잔고는 하루 평균 거래량으로 다 갚는 데 6.1일이 걸리는 규모입니다.'
            )
        ).toBeInTheDocument();
        expect(screen.getByText('FINRA 공매도 잔고')).toBeInTheDocument();
    });

    it('한국 종목 DART 보고는 부호 있는 순변동을 쓴다', () => {
        renderWithIntl(
            <FundamentalFactsCard
                facts={[
                    {
                        kind: 'insiderReportsKr',
                        reports: 4,
                        reporters: 2,
                        netSharesChange: -1200,
                        latestReceiptDate: '2026-10-30',
                    },
                ]}
                symbol="005930.KS"
                displayName="삼성전자"
            />
        );
        expect(
            screen.getByText(
                '최근 임원·주요주주 지분 변동 보고는 4건(보고자 2명)이고, 순변동은 -1,200주입니다.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('DART 공시, 마지막 접수 2026년 10월 30일')
        ).toBeInTheDocument();
    });

    it('en: 같은 사실을 영어 문장으로 그린다', () => {
        renderWithIntl(
            <FundamentalFactsCard
                facts={[ALL_FACTS[5]!]}
                symbol="LAES"
                displayName="SEALSQ"
            />,
            { locale: 'en' }
        );
        expect(
            screen.getByText(
                'EPS missed the consensus estimate in each of the last 2 reports.'
            )
        ).toBeInTheDocument();
    });

    it('en: 개수 1은 단수로 쓴다(ICU plural)', () => {
        renderWithIntl(
            <FundamentalFactsCard
                facts={[
                    {
                        kind: 'dilutionFilings',
                        filings: 1,
                        atmFilings: 1,
                        shelfFilings: 0,
                        windowDays: 180,
                        latestFilingDate: null,
                    },
                    {
                        kind: 'nextEarnings',
                        date: '2026-11-08',
                        daysUntil: 1,
                        lastSurprisePct: null,
                        lastDate: null,
                    },
                ]}
                symbol="LAES"
                displayName="SEALSQ"
            />,
            { locale: 'en' }
        );
        expect(
            screen.getByText(
                'There was 1 SEC filing related to share issuance in the last 180 days (at-the-market offerings: 1, shelf registrations: 0).'
            )
        ).toBeInTheDocument();
        expect(screen.getByText(/, 1 day from now\.$/)).toBeInTheDocument();
    });
});
