// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type {
    InvestorFlowsSnapshot,
    SqueezeRiskScore,
} from '@y0ngha/siglens-core';
import type { CollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { DilutionSection } from '../sections/DilutionSection';
import { FailsToDeliverBlock } from '../sections/FailsToDeliverBlock';
import { OptionsPositionsBlock } from '../sections/OptionsPositionsBlock';
import { ProposedSalesBlock } from '../sections/ProposedSalesBlock';
import { ShortSection } from '../sections/ShortSection';
import { SqueezeScoreCard } from '../sections/SqueezeScoreCard';
import { ThresholdListBadge } from '../sections/ThresholdListBadge';
import {
    evaluate,
    makeExpandedSnapshot,
    makeFailsToDeliver,
    makeOffering,
    makeProposedSale,
    makeSnapshot,
    makeSqueezeContext,
    makeThresholdList,
} from './fixtures/flowsFixtures';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

const NO_ARMS: CollectingArms = {
    institutional: false,
    short: false,
    failsToDeliver: false,
    proposedSales: false,
    offerings: false,
    thresholdList: false,
};

const WINDOW = { from: '2026-04-19', to: '2026-10-16', days: 180 };

function squeezeRisk(over: Partial<SqueezeRiskScore> = {}): SqueezeRiskScore {
    return {
        score: 72,
        level: 'high',
        components: [
            {
                id: 'short_interest_pct_float',
                value: 19.5,
                normalized: 0.8,
                weight: 0.3,
                contribution: 24,
            },
            {
                id: 'price_change_20d',
                value: 22,
                normalized: 0.9,
                weight: 0.25,
                contribution: 23,
            },
        ],
        missing: [],
        sufficiency: 'full',
        levelCapped: false,
        includesFinra: true,
        includesExchangeLists: false,
        asOf: '2026-10-16',
        lastBarDate: '2026-10-15',
        ...over,
    };
}

describe('SqueezeScoreCard', () => {
    it('shows the core score, a text level label and each component with its points', () => {
        render(<SqueezeScoreCard risk={squeezeRisk()} />);
        const card = screen.getByTestId('flows-squeeze-card');
        expect(within(card).getByText('72 / 100')).toBeInTheDocument();
        expect(within(card).getByText('높음')).toBeInTheDocument();
        expect(
            within(card).getByText(/공매도 잔고\(유통주식 대비\)/)
        ).toBeInTheDocument();
        expect(within(card).getByText('+24점')).toBeInTheDocument();
        expect(within(card).getByText('19.50%')).toBeInTheDocument();
        expect(within(card).getByText('+22.0%')).toBeInTheDocument();
    });

    it('names the sources that went in, and the last close the price inputs used', () => {
        render(<SqueezeScoreCard risk={squeezeRisk()} />);
        expect(
            screen.getByText(
                '반영한 자료: FINRA 공매도 · 일봉 가격·거래량 (가격은 2026-10-15 종가까지)'
            )
        ).toBeInTheDocument();
    });

    it('lists the exchange lists and SEC fails only when they contributed', () => {
        render(
            <SqueezeScoreCard
                risk={squeezeRisk({
                    includesFinra: false,
                    includesExchangeLists: true,
                    lastBarDate: null,
                    components: [
                        {
                            id: 'fails_to_deliver_pct',
                            value: 0.6,
                            normalized: 0.6,
                            weight: 0.5,
                            contribution: 30,
                        },
                    ],
                })}
            />
        );
        expect(
            screen.getByText('반영한 자료: SEC 결제 불이행 · 거래소 과열 목록')
        ).toBeInTheDocument();
    });

    it('explains a partial score and a capped level', () => {
        render(
            <SqueezeScoreCard
                risk={squeezeRisk({
                    sufficiency: 'partial',
                    missing: ['days_to_cover', 'short_interest_trend'],
                    levelCapped: true,
                    level: 'elevated',
                })}
            />
        );
        expect(
            screen.getByText(/입력 2개가 없어 나머지 입력으로/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/'주의'보다 높게 보지 않아요/)
        ).toBeInTheDocument();
        expect(screen.getByText('주의')).toBeInTheDocument();
    });

    it('says it did not score when the short side is insufficient (no number)', () => {
        render(
            <SqueezeScoreCard
                risk={squeezeRisk({
                    score: null,
                    level: null,
                    components: [],
                    sufficiency: 'insufficient',
                })}
            />
        );
        expect(
            screen.getByText(/공매도 쪽 데이터가 부족해 점수를 내지 않았어요/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/\/ 100/)).toBeNull();
    });
});

describe('FailsToDeliverBlock', () => {
    const metrics = evaluate(makeExpandedSnapshot()).short.metrics;

    it('draws the bar chart, the latest date and the SEC caveat and lag note', () => {
        render(
            <FailsToDeliverBlock
                points={makeFailsToDeliver()}
                metrics={metrics}
                collecting={false}
            />
        );
        expect(
            screen.getByRole('img', { name: /결제 불이행이 있던 5개 결제일/ })
        ).toBeInTheDocument();
        expect(
            screen.getByText('가장 최근 기록은 결제일 2026-09-30예요.')
        ).toBeInTheDocument();
        expect(
            screen.getByText(/결제 불이행은 무차입 공매도의 증거가 아니에요/)
        ).toBeInTheDocument();
        expect(screen.getByText(/약 2주 뒤에 공개해요/)).toBeInTheDocument();
    });

    it('says there were no fails in the window for an empty list', () => {
        render(
            <FailsToDeliverBlock
                points={[]}
                metrics={metrics}
                collecting={false}
            />
        );
        expect(
            screen.getByText(/최근 120일 동안 결제 불이행 기록이 없어요/)
        ).toBeInTheDocument();
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('says it could not load for null (different from "no fails")', () => {
        render(
            <FailsToDeliverBlock
                points={null}
                metrics={metrics}
                collecting={false}
            />
        );
        expect(
            screen.getByText(/결제 불이행 자료를 불러오지 못했어요/)
        ).toBeInTheDocument();
    });

    it('shows the collecting notice while the first file is not stored yet', () => {
        render(
            <FailsToDeliverBlock points={[]} metrics={metrics} collecting />
        );
        expect(
            screen.getByTestId('flows-collecting-failsToDeliver')
        ).toBeInTheDocument();
    });
});

describe('ThresholdListBadge', () => {
    it('shows a listed badge with the streak, markets and dated exchange source', () => {
        render(<ThresholdListBadge status={makeThresholdList()} />);
        expect(screen.getByText('과열 목록 등재')).toBeInTheDocument();
        expect(screen.getByText('15거래일 연속 · Nasdaq')).toBeInTheDocument();
        expect(
            screen.getByText('출처: Nasdaq·NYSE·Cboe (2026-10-15 목록 기준)')
        ).toBeInTheDocument();
    });

    it('states "not listed" plainly without the warning badge', () => {
        render(
            <ThresholdListBadge
                status={makeThresholdList({
                    listed: false,
                    consecutiveDays: 0,
                    markets: [],
                })}
            />
        );
        expect(
            screen.getByText('지금은 과열 목록에 없어요.')
        ).toBeInTheDocument();
        expect(screen.queryByText('과열 목록 등재')).toBeNull();
    });

    it('says it is collecting before the first list (and claims no source yet)', () => {
        render(<ThresholdListBadge status={null} />);
        expect(
            screen.getByText('과열 목록을 모으는 중이에요.')
        ).toBeInTheDocument();
        expect(screen.queryByText(/출처/)).toBeNull();
    });
});

describe('ProposedSalesBlock', () => {
    it('lists filer, relationship, shares, value, sale date and a 10b5-1 badge for planned sales', () => {
        render(
            <ProposedSalesBlock
                sales={[
                    makeProposedSale(),
                    makeProposedSale({
                        filer: 'Fixture Director C',
                        filingDate: '2026-09-01',
                        planAdoptionDate: null,
                    }),
                ]}
                collecting={false}
            />
        );
        const block = screen.getByTestId('flows-form144');
        expect(
            within(block).getAllByText('Fixture Officer F').length
        ).toBeGreaterThan(0);
        // 카드(좁은 화면)와 표(넓은 화면) 두 벌이라 배지는 계획 매도 1건 × 2다.
        expect(within(block).getAllByText('10b5-1 계획')).toHaveLength(2);
        expect(within(block).getAllByText('2026-10-13').length).toBeGreaterThan(
            0
        );
        const link = within(block).getAllByRole('link', {
            name: '공시 보기',
        })[0];
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('does not link a non-https URL', () => {
        render(
            <ProposedSalesBlock
                sales={[makeProposedSale({ url: 'javascript:alert(1)' })]}
                collecting={false}
            />
        );
        expect(screen.queryByRole('link', { name: '공시 보기' })).toBeNull();
    });

    it('separates "none on file", "could not load" and "collecting"', () => {
        const { rerender } = render(
            <ProposedSalesBlock sales={[]} collecting={false} />
        );
        expect(
            screen.getByText('접수된 매도 예정 신고가 없어요.')
        ).toBeInTheDocument();
        rerender(<ProposedSalesBlock sales={undefined} collecting={false} />);
        expect(
            screen.getByText(/매도 예정 신고를 불러오지 못했어요/)
        ).toBeInTheDocument();
        rerender(<ProposedSalesBlock sales={[]} collecting />);
        expect(
            screen.getByTestId('flows-collecting-filings')
        ).toBeInTheDocument();
    });
});

describe('DilutionSection', () => {
    it('shows kind badges as text, the form, date, SEC link and the scoring window', () => {
        render(
            <DilutionSection
                filings={[
                    makeOffering(),
                    makeOffering({
                        form: 'S-3ASR',
                        kind: 'shelf',
                        filingDate: '2026-07-10',
                        url: 'https://www.sec.gov/s3',
                    }),
                    makeOffering({
                        form: 'D',
                        kind: 'private_placement',
                        filingDate: '2026-05-01',
                        url: 'https://www.sec.gov/d',
                    }),
                ]}
                scoringWindow={WINDOW}
                collecting={false}
            />
        );
        const section = screen
            .getByRole('heading', { level: 2, name: /증자·희석 공시/ })
            .closest('section') as HTMLElement;
        for (const label of ['ATM', '선반 등록', '사모']) {
            expect(within(section).getByText(label)).toBeInTheDocument();
        }
        expect(within(section).getByText('424B5')).toBeInTheDocument();
        expect(
            within(section).getAllByRole('link', { name: 'SEC 원문' })
        ).toHaveLength(3);
        expect(
            within(section).getByText(
                '점수는 최근 180일(2026-04-19 ~ 2026-10-16) 공시로 매겨요.'
            )
        ).toBeInTheDocument();
        expect(
            within(section).getByText(/출처: 미국 SEC EDGAR/)
        ).toBeInTheDocument();
    });

    it('separates "none on file", "could not load" and "collecting"', () => {
        const { rerender } = render(
            <DilutionSection
                filings={[]}
                scoringWindow={WINDOW}
                collecting={false}
            />
        );
        expect(
            screen.getByText('접수된 증자·희석 공시가 없어요.')
        ).toBeInTheDocument();
        rerender(
            <DilutionSection
                filings={undefined}
                scoringWindow={WINDOW}
                collecting={false}
            />
        );
        expect(
            screen.getByText(/증자·희석 공시를 불러오지 못했어요/)
        ).toBeInTheDocument();
        rerender(
            <DilutionSection filings={[]} scoringWindow={WINDOW} collecting />
        );
        expect(
            screen.getByTestId('flows-collecting-filings')
        ).toBeInTheDocument();
    });
});

describe('OptionsPositionsBlock', () => {
    it('shows put and call notional with filer counts, the hedge caveat and the core ratio', () => {
        const snapshot = makeExpandedSnapshot();
        const metrics = evaluate(snapshot).institutional.metrics;
        render(
            <OptionsPositionsBlock
                quarters={snapshot.institutional.options ?? []}
                metrics={metrics}
            />
        );
        const block = screen.getByTestId('flows-options');
        expect(
            within(block).getByText(/헤지일 때가 많아요/)
        ).toBeInTheDocument();
        expect(within(block).getAllByText(/640곳/).length).toBeGreaterThan(0);
        expect(
            within(block).getByText(
                /2026-06-30 풋\/콜 명목 비율 1\.47 \(직전 분기 0\.75\)/
            )
        ).toBeInTheDocument();
    });

    it('renders nothing without option quarters', () => {
        const { container } = render(
            <OptionsPositionsBlock
                quarters={[]}
                metrics={evaluate(makeSnapshot()).institutional.metrics}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});

describe('ShortSection — expansion wiring', () => {
    const props = (
        snapshot: InvestorFlowsSnapshot,
        over: { regShoEnabled?: boolean; squeeze?: boolean } = {}
    ) => ({
        snapshot,
        scorecard: evaluate(
            snapshot,
            true,
            over.squeeze === false
                ? {}
                : { squeezeContext: makeSqueezeContext() }
        ),
        finraEnabled: true,
        regShoEnabled: over.regShoEnabled ?? true,
        collecting: NO_ARMS,
    });

    it('puts the squeeze score card first when core scored it with price context', () => {
        render(<ShortSection {...props(makeExpandedSnapshot())} />);
        const section = screen
            .getByRole('heading', { level: 2, name: /^공매도/ })
            .closest('section') as HTMLElement;
        const card = within(section).getByTestId('flows-squeeze-card');
        const ftd = within(section).getByTestId('flows-ftd');
        expect(
            card.compareDocumentPosition(ftd) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('omits the squeeze card without price context', () => {
        render(
            <ShortSection
                {...props(makeExpandedSnapshot(), { squeeze: false })}
            />
        );
        expect(screen.queryByTestId('flows-squeeze-card')).toBeNull();
    });

    it('draws the threshold badge only while the Reg SHO flag is on', () => {
        const snapshot = makeExpandedSnapshot({
            thresholdList: makeThresholdList(),
        });
        const { rerender } = render(<ShortSection {...props(snapshot)} />);
        expect(screen.getByTestId('flows-threshold')).toBeInTheDocument();
        rerender(
            <ShortSection {...props(snapshot, { regShoEnabled: false })} />
        );
        expect(screen.queryByTestId('flows-threshold')).toBeNull();
        expect(screen.queryByText(/Nasdaq/)).toBeNull();
    });
});
