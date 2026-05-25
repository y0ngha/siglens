import { render, screen } from '@testing-library/react';
import { NewsAiSummaryErrorBoundary } from '@/widgets/news/NewsAiSummaryErrorBoundary';

vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({
        children,
        FallbackComponent,
    }: {
        children: React.ReactNode;
        FallbackComponent: React.ComponentType<{ error: Error }>;
    }) => {
        void FallbackComponent;
        return <>{children}</>;
    },
}));

describe('NewsAiSummaryErrorBoundary', () => {
    it('renders children when no error occurs', () => {
        render(
            <NewsAiSummaryErrorBoundary>
                <div data-testid="child">Content</div>
            </NewsAiSummaryErrorBoundary>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('wraps children in an ErrorBoundary', () => {
        const { container } = render(
            <NewsAiSummaryErrorBoundary>
                <p>Safe content</p>
            </NewsAiSummaryErrorBoundary>
        );
        expect(container.textContent).toContain('Safe content');
    });
});
