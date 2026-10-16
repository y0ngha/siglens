// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvestorFlowsSummary } from '../InvestorFlowsSummary';
import { InvestorFlowsSummaryView } from '../InvestorFlowsSummaryView';
import { InvestorFlowsSummarySkeleton } from '../InvestorFlowsSummarySkeleton';
import { SUMMARY_RESERVED_HEIGHT } from '../utils/summaryReservedHeight';

const { mockHook } = vi.hoisted(() => ({ mockHook: vi.fn() }));
vi.mock('../hooks/useInvestorFlowsAnalysis', () => ({
    useInvestorFlowsAnalysis: mockHook,
}));
vi.mock('@/features/symbol-model/hooks/useDefaultModelId', () => ({
    useDefaultModelId: () => 'gemini-3.5-flash-lite',
}));
vi.mock('@/features/symbol-model/hooks/useDefaultReasoning', () => ({
    useDefaultReasoning: () => false,
}));
vi.mock('@/features/symbol-model/hooks/useAnalysisSettingsHydrated', () => ({
    useAnalysisSettingsHydrated: () => true,
}));
const grant = vi.fn();
vi.mock('@/features/symbol-model/hooks/useAiAutoRunAllowed', () => ({
    useAiAutoRunAllowed: () => ({ allowed: true, grant }),
}));

const RESULT = {
    summaryKo: '기관은 순매수예요.',
    axisInterpretations: [
        { axis: 'institutional' as const, interpretationKo: 'IN이 우세해요.' },
        { axis: 'short' as const, interpretationKo: '잔고가 늘었어요.' },
    ],
    keySignalsKo: ['클러스터 매수'],
    risksKo: ['13F는 지연 자료'],
    dataNotesKo: [],
};

describe('InvestorFlowsSummaryView', () => {
    it('요약·축별 해석·핵심 신호·유의점을 그리고 빈 블록은 뺀다', () => {
        render(<InvestorFlowsSummaryView result={RESULT} />);
        expect(screen.getByText('기관은 순매수예요.')).toBeInTheDocument();
        expect(screen.getByText('기관')).toBeInTheDocument();
        expect(screen.getByText('IN이 우세해요.')).toBeInTheDocument();
        expect(screen.getByText('클러스터 매수')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '유의할 점' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: '데이터 참고' })
        ).toBeNull();
    });

    it('정규화로 비워진 응답이어도 제목만 남기고 깨지지 않는다', () => {
        render(
            <InvestorFlowsSummaryView
                result={{
                    summaryKo: '',
                    axisInterpretations: [],
                    keySignalsKo: [],
                    risksKo: [],
                    dataNotesKo: [],
                }}
            />
        );
        expect(
            screen.getByRole('heading', { name: 'AI 수급 해석' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('list')).toBeNull();
    });
});

describe('InvestorFlowsSummary', () => {
    it('loading이면 스켈레톤(aria-busy)', () => {
        mockHook.mockReturnValue({ status: 'loading', trigger: vi.fn() });
        const { container } = render(<InvestorFlowsSummary symbol="AAPL" />);
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    it('done이면 결과 카드', () => {
        mockHook.mockReturnValue({
            status: 'done',
            result: RESULT,
            trigger: vi.fn(),
        });
        render(<InvestorFlowsSummary symbol="AAPL" />);
        expect(screen.getByText('기관은 순매수예요.')).toBeInTheDocument();
    });

    it('no_data면 AI를 만들지 않았다고 알린다', () => {
        mockHook.mockReturnValue({ status: 'no_data', trigger: vi.fn() });
        render(<InvestorFlowsSummary symbol="AAPL" />);
        expect(
            screen.getByText(/AI 해석을 만들지 않았어요/)
        ).toBeInTheDocument();
    });

    it('error면 재시도 가능한 오류 섹션', () => {
        mockHook.mockReturnValue({
            status: 'error',
            error: new Error('실패했어요'),
            retry: vi.fn(),
            trigger: vi.fn(),
        });
        render(<InvestorFlowsSummary symbol="AAPL" />);
        expect(screen.getByRole('alert')).toHaveTextContent('실패했어요');
    });

    it('awaiting_interaction이면 시작 버튼을 낸다', () => {
        mockHook.mockReturnValue({
            status: 'awaiting_interaction',
            trigger: vi.fn(),
        });
        render(<InvestorFlowsSummary symbol="AAPL" />);
        expect(screen.getByRole('button')).toBeInTheDocument();
    });
});

describe('InvestorFlowsSummarySkeleton', () => {
    it('제목과 진행 문구를 낸다', () => {
        render(<InvestorFlowsSummarySkeleton />);
        expect(screen.getByText('AI 수급 해석 진행 중…')).toBeInTheDocument();
    });

    describe('결과 전 높이 예약(점수 카드가 밀리지 않게)', () => {
        const reservedClasses = SUMMARY_RESERVED_HEIGHT.split(' ');

        it('loading 스켈레톤은 예약 높이 래퍼 안에 있다', () => {
            mockHook.mockReturnValue({ status: 'loading', trigger: vi.fn() });
            const { container } = render(
                <InvestorFlowsSummary symbol="AAPL" />
            );
            const wrapper = container.firstElementChild!;
            for (const c of reservedClasses) expect(wrapper).toHaveClass(c);
            expect(wrapper.querySelector('[aria-busy="true"]')).not.toBeNull();
        });

        it('awaiting_interaction 카드는 자기 높이로 그린다(예약하지 않는다)', () => {
            mockHook.mockReturnValue({
                status: 'awaiting_interaction',
                trigger: vi.fn(),
            });
            const { container } = render(
                <InvestorFlowsSummary symbol="AAPL" />
            );
            for (const c of reservedClasses)
                expect(container.firstElementChild).not.toHaveClass(c);
        });

        it('결과(done)는 예약 래퍼 없이 자기 높이로 그린다', () => {
            mockHook.mockReturnValue({
                status: 'done',
                result: RESULT,
                trigger: vi.fn(),
            });
            const { container } = render(
                <InvestorFlowsSummary symbol="AAPL" />
            );
            for (const c of reservedClasses)
                expect(container.firstElementChild).not.toHaveClass(c);
        });
    });
});
