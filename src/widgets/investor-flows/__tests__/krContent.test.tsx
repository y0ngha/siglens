// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import { KrInvestorFlowsContent } from '../KrInvestorFlowsContent';
import { InvestorFlowsEmpty } from '../InvestorFlowsEmpty';
import { InvestorFlowsSummaryView } from '../InvestorFlowsSummaryView';
import { KrMajorHoldersSection } from '../sections/KrMajorHoldersSection';
import { KrInsiderSection } from '../sections/KrInsiderSection';
import { KrTradingPlansSection } from '../sections/KrTradingPlansSection';
import { MAX_KR_DISCLOSURE_ROWS } from '../utils/krDisclosures';
import {
    evaluate,
    makeKrMajorHoldingRecord,
    makeKrSnapshot,
    makeKrTradingPlanRecord,
} from './fixtures/flowsFixtures';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

const READY: InvestorFlowsPipelineReadiness = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
    dart: 'ready',
};

function renderContent(
    over: Partial<Parameters<typeof KrInvestorFlowsContent>[0]> = {}
) {
    const snapshot = makeKrSnapshot();
    return render(
        <KrInvestorFlowsContent
            snapshot={snapshot}
            scorecard={evaluate(snapshot)}
            readiness={READY}
            krCompany={{ corpName: '삼성전자', viaCommonShare: false }}
            {...over}
        />
    );
}

describe('KrInvestorFlowsContent', () => {
    it('draws only the two DART axes and says the US-only scores are not provided', () => {
        renderContent();
        const card = screen
            .getByRole('heading', { level: 2, name: /수급 점수/ })
            .closest('section') as HTMLElement;
        const axes = within(card)
            .getAllByRole('heading', { level: 3 })
            .map(h => h.textContent);
        expect(axes).toHaveLength(2);
        expect(axes[0]).toContain('대량보유(5%)');
        expect(axes[1]).toContain('임원·주요주주');
        expect(
            within(card).getByText(
                /기관·공매도·증자 희석 점수는 제공하지 않아요/
            )
        ).toBeInTheDocument();
        // 13F·FINRA·SEC 섹션은 없다.
        expect(screen.queryByText(/13F/)).toBeNull();
        expect(screen.queryByText(/FINRA/)).toBeNull();
    });

    it('shows the DART evidence lines from the core krMetrics', () => {
        renderContent();
        expect(
            screen.getByText(/대량보유 보고 2건 · 보고자 2명/)
        ).toBeInTheDocument();
        expect(screen.getByText(/거래계획 보고서 1건/)).toBeInTheDocument();
    });

    it('cites DART as the source and states that institutional/foreign net buying is not provided', () => {
        renderContent();
        const asOf = screen.getByTestId('flows-kr-asof');
        expect(
            within(asOf).getByText('출처: 금융감독원 전자공시시스템(DART)')
        ).toBeInTheDocument();
        expect(
            within(asOf).getByText('기관·외국인 순매수는 제공하지 않아요.')
        ).toBeInTheDocument();
        expect(within(asOf).getByText('2026-10-14')).toBeInTheDocument();
    });

    it('adds the preferred-share note only when the mapping went through the common share', () => {
        const { unmount } = renderContent();
        expect(screen.queryByTestId('flows-kr-preferred-note')).toBeNull();
        unmount();
        renderContent({
            krCompany: { corpName: '삼성전자', viaCommonShare: true },
        });
        expect(screen.getByTestId('flows-kr-preferred-note')).toHaveTextContent(
            '지분공시는 회사 단위라 삼성전자 보통주와 같은 내용이에요.'
        );
    });

    it('renders the major-holder, insider and trading-plan sections in that order', () => {
        renderContent();
        const ids = [
            'flows-kr-major-holders',
            'flows-kr-insiders',
            'flows-kr-trading-plans',
        ].map(id => screen.getByTestId(id));
        expect(
            ids[0].compareDocumentPosition(ids[1]) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
            ids[1].compareDocumentPosition(ids[2]) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });
});

describe('KrMajorHoldersSection', () => {
    const reports = makeKrSnapshot().kr!.majorHolders;

    it('shows form, ratio with %p change, share change, reason and a DART link in the desktop table', () => {
        render(<KrMajorHoldersSection reports={reports} collecting={false} />);
        const table = screen.getByRole('table');
        const row = within(table)
            .getByRole('rowheader', { name: '국민연금공단' })
            .closest('tr') as HTMLElement;
        expect(within(row).getByText('일반')).toBeInTheDocument();
        expect(within(row).getByText('7.24%')).toBeInTheDocument();
        expect(within(row).getByText('-0.09%p')).toBeInTheDocument();
        expect(
            within(row).getByText('보유주식등의 수 변동')
        ).toBeInTheDocument();
        expect(
            within(row).getByRole('link', { name: '국민연금공단 DART 원문' })
        ).toHaveAttribute(
            'href',
            'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261010000001'
        );
        expect(within(table).getByText('약식')).toBeInTheDocument();
    });

    it('lists the newest receipt first', () => {
        render(<KrMajorHoldersSection reports={reports} collecting={false} />);
        const headers = within(screen.getByRole('table'))
            .getAllByRole('rowheader')
            .map(h => h.textContent);
        expect(headers).toEqual(['픽스처자산운용', '국민연금공단']);
    });

    it('says there were no reports when the list is empty', () => {
        render(<KrMajorHoldersSection reports={[]} collecting={false} />);
        expect(
            screen.getByText('최근 2년 동안 접수된 대량보유 보고가 없어요.')
        ).toBeInTheDocument();
    });

    it('says the filings are still being collected instead of "none" during the DART backfill', () => {
        render(<KrMajorHoldersSection reports={[]} collecting />);
        expect(screen.getByTestId('flows-collecting-dart')).toBeInTheDocument();
        expect(screen.queryByText(/대량보유 보고가 없어요/)).toBeNull();
    });

    it('caps the list and reports how many older rows were left out', () => {
        const many = makeKrSnapshot({
            majorHoldings: Array.from(
                { length: MAX_KR_DISCLOSURE_ROWS + 2 },
                (_, i) =>
                    makeKrMajorHoldingRecord({
                        rceptNo: `2026100100${String(i).padStart(4, '0')}`,
                        reporter: `보고자${i}`,
                    })
            ),
        }).kr!.majorHolders;
        render(<KrMajorHoldersSection reports={many} collecting={false} />);
        expect(
            within(screen.getByRole('table')).getAllByRole('rowheader')
        ).toHaveLength(MAX_KR_DISCLOSURE_ROWS);
        expect(
            screen.getByText('오래된 보고 2건은 목록에서 뺐어요.')
        ).toBeInTheDocument();
    });
});

describe('KrInsiderSection', () => {
    const reports = makeKrSnapshot().kr!.insiders;

    it('shows position, registration, major-shareholder flag, shares and ratio with changes', () => {
        render(<KrInsiderSection reports={reports} collecting={false} />);
        const table = screen.getByRole('table');
        const officer = within(table)
            .getByRole('rowheader', { name: /최임원/ })
            .closest('tr') as HTMLElement;
        expect(within(officer).getByText('부사장')).toBeInTheDocument();
        expect(within(officer).getByText('비등기')).toBeInTheDocument();
        expect(within(officer).getByText('아님')).toBeInTheDocument();
        const holder = within(table)
            .getByRole('rowheader', { name: /박주주/ })
            .closest('tr') as HTMLElement;
        expect(within(holder).getByText('직위 없음')).toBeInTheDocument();
        expect(within(holder).getByText('해당')).toBeInTheDocument();
        expect(within(holder).getByText('10.89%')).toBeInTheDocument();
        expect(within(holder).getByText('+0.30%p')).toBeInTheDocument();
    });

    it('says there were no reports when the list is empty', () => {
        render(<KrInsiderSection reports={[]} collecting={false} />);
        expect(
            screen.getByText(
                '최근 2년 동안 접수된 임원·주요주주 소유 보고가 없어요.'
            )
        ).toBeInTheDocument();
    });
});

describe('KrTradingPlansSection', () => {
    it('keeps two plans that share a receipt number apart (key includes the reporter)', () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const plans = makeKrSnapshot({
            tradingPlans: [
                makeKrTradingPlanRecord({ reporter: '이임원' }),
                makeKrTradingPlanRecord({ reporter: '김임원' }),
            ],
        }).kr!.tradingPlans;
        render(<KrTradingPlansSection plans={plans} collecting={false} />);
        expect(screen.getByText('이임원')).toBeInTheDocument();
        expect(screen.getByText('김임원')).toBeInTheDocument();
        expect(
            error.mock.calls.some(call => String(call[0]).includes('same key'))
        ).toBe(false);
        error.mockRestore();
    });

    it('lists the reporter, title, receipt date and link', () => {
        render(
            <KrTradingPlansSection
                plans={makeKrSnapshot().kr!.tradingPlans}
                collecting={false}
            />
        );
        expect(screen.getByText('이임원')).toBeInTheDocument();
        expect(screen.getByText('2026-10-12')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '이임원 DART 원문' })
        ).toBeInTheDocument();
    });

    it('says there were no reports when the list is empty', () => {
        render(<KrTradingPlansSection plans={[]} collecting={false} />);
        expect(
            screen.getByText('최근 2년 동안 접수된 거래계획 보고서가 없어요.')
        ).toBeInTheDocument();
    });
});

describe('InvestorFlowsEmpty — Korean listing', () => {
    it('says "no data" in DART terms with the source and the not-provided note', () => {
        render(<InvestorFlowsEmpty market="kr" />);
        expect(
            screen.getByText(/최근 2년 동안 이 종목의 대량보유·임원 소유 공시/)
        ).toBeInTheDocument();
        expect(
            screen.getByText('출처: 금융감독원 전자공시시스템(DART)')
        ).toBeInTheDocument();
        expect(screen.queryByText(/13F/)).toBeNull();
    });

    it('says DART filings are being collected (never the 13F wording)', () => {
        render(<InvestorFlowsEmpty market="kr" collecting />);
        expect(
            screen.getByRole('heading', { name: '지분 공시를 모으는 중이에요' })
        ).toBeInTheDocument();
        expect(screen.queryByText(/13F/)).toBeNull();
    });
});

describe('InvestorFlowsSummaryView — Korean listing', () => {
    it('names the insider axis 임원·주요주주 for a Korean result', () => {
        render(
            <InvestorFlowsSummaryView
                market="kr"
                result={{
                    summaryKo: '요약',
                    axisInterpretations: [
                        { axis: 'insider', interpretationKo: '해석' },
                    ],
                    keySignalsKo: [],
                    risksKo: [],
                    dataNotesKo: [],
                }}
            />
        );
        expect(screen.getByText('임원·주요주주')).toBeInTheDocument();
    });
});
