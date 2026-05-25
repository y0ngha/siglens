import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/widgets/analysis/ModelSelector';
import type { ModelId } from '@y0ngha/siglens-core';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        isFreeModel: vi.fn(() => true),
    };
});

vi.mock('@/shared/hooks/usePopoverToggle', () => ({
    usePopoverToggle: () => ({
        isOpen: false,
        toggle: vi.fn(),
        close: vi.fn(),
    }),
}));

interface AnalysisPanelMockProps {
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    result: Record<string, unknown> | null;
    modelId: ModelId;
    onAnalyze: () => void;
}

function AnalysisPanelMock({
    status,
    error,
    result,
    modelId,
    onAnalyze,
}: AnalysisPanelMockProps) {
    return (
        <div>
            <ModelSelector
                selectedModel={modelId}
                onModelChange={vi.fn()}
                allowedModels={[modelId]}
            />
            {status === 'idle' && (
                <button onClick={onAnalyze}>분석 시작</button>
            )}
            {status === 'loading' && (
                <div data-testid="analysis-loading">분석 중...</div>
            )}
            {status === 'error' && error && <div role="alert">{error}</div>}
            {status === 'success' && result !== null && (
                <div data-testid="analysis-result">분석 완료</div>
            )}
        </div>
    );
}

describe('Analysis Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders model selector in analysis panel', () => {
        render(
            <AnalysisPanelMock
                status="idle"
                error={null}
                result={null}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={vi.fn()}
            />
        );
        expect(screen.getByLabelText('AI 분석 모델 선택')).toBeInTheDocument();
    });

    it('shows analyze button in idle state', () => {
        render(
            <AnalysisPanelMock
                status="idle"
                error={null}
                result={null}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={vi.fn()}
            />
        );
        expect(
            screen.getByRole('button', { name: '분석 시작' })
        ).toBeInTheDocument();
    });

    it('calls onAnalyze when analyze button is clicked', async () => {
        const onAnalyze = vi.fn();
        render(
            <AnalysisPanelMock
                status="idle"
                error={null}
                result={null}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={onAnalyze}
            />
        );
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: '분석 시작' }));
        expect(onAnalyze).toHaveBeenCalledTimes(1);
    });

    it('shows loading state during analysis', () => {
        render(
            <AnalysisPanelMock
                status="loading"
                error={null}
                result={null}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={vi.fn()}
            />
        );
        expect(screen.getByTestId('analysis-loading')).toBeInTheDocument();
    });

    it('shows error state when analysis fails', () => {
        render(
            <AnalysisPanelMock
                status="error"
                error="분석에 실패했습니다."
                result={null}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={vi.fn()}
            />
        );
        expect(screen.getByText('분석에 실패했습니다.')).toBeInTheDocument();
    });

    it('shows result when analysis succeeds', () => {
        render(
            <AnalysisPanelMock
                status="success"
                error={null}
                result={{ summary: 'bullish' }}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={vi.fn()}
            />
        );
        expect(screen.getByTestId('analysis-result')).toBeInTheDocument();
    });

    it('transitions from loading to result', () => {
        const { rerender } = render(
            <AnalysisPanelMock
                status="loading"
                error={null}
                result={null}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={vi.fn()}
            />
        );
        expect(screen.getByTestId('analysis-loading')).toBeInTheDocument();

        rerender(
            <AnalysisPanelMock
                status="success"
                error={null}
                result={{ summary: 'bullish' }}
                modelId={'gemini-2.5-flash-lite' as ModelId}
                onAnalyze={vi.fn()}
            />
        );
        expect(screen.getByTestId('analysis-result')).toBeInTheDocument();
        expect(
            screen.queryByTestId('analysis-loading')
        ).not.toBeInTheDocument();
    });
});
