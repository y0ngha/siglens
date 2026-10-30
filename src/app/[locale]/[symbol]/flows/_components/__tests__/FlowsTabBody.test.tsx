vi.mock('@/entities/investor-flows/lib/investorFlowsReadiness', () => ({
    isKrDisclosureCollecting: vi.fn(() => true),
}));
vi.mock('@/widgets/investor-flows/InvestorFlowsEmpty', () => ({
    InvestorFlowsEmpty: (props: {
        market?: string;
        collecting: boolean;
        shortCollecting?: boolean;
    }) => (
        <div
            data-testid="flows-empty"
            data-market={props.market ?? 'us'}
            data-collecting={String(props.collecting)}
            data-short-collecting={String(props.shortCollecting)}
        />
    ),
}));
vi.mock('@/widgets/investor-flows/KrInvestorFlowsContent', () => ({
    KrInvestorFlowsContent: () => <div data-testid="kr-content" />,
}));
vi.mock('@/widgets/investor-flows/InvestorFlowsContent', () => ({
    InvestorFlowsContent: (props: { finraEnabled: boolean }) => (
        <div data-testid="us-content" data-finra={String(props.finraEnabled)} />
    ),
}));
vi.mock('@/widgets/investor-flows/InvestorFlowsSummary', () => ({
    InvestorFlowsSummary: ({ symbol }: { symbol: string }) => (
        <div data-testid="ai-summary" data-symbol={symbol} />
    ),
}));

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FlowsTabBody } from '@/app/[locale]/[symbol]/flows/_components/FlowsTabBody';
import { isKrDisclosureCollecting } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import type { InvestorFlowsScorecardResult } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';

const READINESS = {
    institutional: 'collecting',
    short: 'collecting',
    dart: 'collecting',
};

/** 이 컴포넌트가 읽는 필드만 채운 수급 결과(스냅샷·점수는 하위 위젯이 목이라 모양만 있으면 된다). */
function flows(
    overrides: Partial<InvestorFlowsScorecardResult>
): InvestorFlowsScorecardResult {
    return {
        snapshot: {},
        scorecard: {},
        finraEnabled: true,
        regShoEnabled: false,
        readiness: READINESS,
        krCompany: null,
        degraded: false,
        ...overrides,
    } as unknown as InvestorFlowsScorecardResult;
}

/** 렌더된 블록의 testid를 DOM 순서대로. */
const order = (container: HTMLElement): (string | null)[] =>
    [...container.querySelectorAll('[data-testid]')].map(el =>
        el.getAttribute('data-testid')
    );

describe('FlowsTabBody', () => {
    it('한국 종목에 데이터가 없으면 DART 수집 상태로 빈 화면을 그리고 AI를 부르지 않는다', () => {
        const { container } = render(
            <FlowsTabBody
                flows={flows({ snapshot: null, scorecard: null })}
                symbol="005930.KS"
                krListing
            />
        );

        expect(order(container)).toEqual(['flows-empty']);
        expect(screen.getByTestId('flows-empty').dataset.market).toBe('kr');
        expect(screen.getByTestId('flows-empty').dataset.collecting).toBe(
            'true'
        );
        expect(isKrDisclosureCollecting).toHaveBeenCalledWith(READINESS, null);
    });

    it('미국 종목에 데이터가 없으면 13F·FINRA 수집 상태로 빈 화면을 그리고 AI를 부르지 않는다', () => {
        const { container } = render(
            <FlowsTabBody
                flows={flows({ snapshot: null, scorecard: null })}
                symbol="AAPL"
                krListing={false}
            />
        );

        expect(order(container)).toEqual(['flows-empty']);
        const empty = screen.getByTestId('flows-empty');
        expect(empty.dataset.market).toBe('us');
        expect(empty.dataset.collecting).toBe('true');
        expect(empty.dataset.shortCollecting).toBe('true');
    });

    it('한국 종목은 표를 먼저, AI 해석을 마지막에 그린다', () => {
        const { container } = render(
            <FlowsTabBody flows={flows({})} symbol="005930.KS" krListing />
        );

        expect(order(container)).toEqual(['kr-content', 'ai-summary']);
        expect(screen.getByTestId('ai-summary').dataset.symbol).toBe(
            '005930.KS'
        );
    });

    it('미국 종목은 AI 해석을 맨 위에, 수급 표를 그 아래에 그린다', () => {
        const { container } = render(
            <FlowsTabBody flows={flows({})} symbol="AAPL" krListing={false} />
        );

        expect(order(container)).toEqual(['ai-summary', 'us-content']);
        expect(screen.getByTestId('us-content').dataset.finra).toBe('true');
    });
});
