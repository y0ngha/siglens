vi.mock('@/shared/config/queryConfig', () => ({
    QUERY_STALE_TIME_MS: 5000,
    QUERY_GC_TIME_MS: 300000,
}));
vi.mock('@tanstack/react-query', () => ({
    QueryClient: class MockQueryClient {
        constructor() {
            return {};
        }
    },
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="query-provider">{children}</div>
    ),
}));

import { render, screen } from '@testing-library/react';
import { ReactQueryProvider } from '@/app/providers';

describe('ReactQueryProvider', () => {
    it('renders children inside QueryClientProvider', () => {
        render(
            <ReactQueryProvider>
                <div data-testid="child">test</div>
            </ReactQueryProvider>
        );

        expect(screen.getByTestId('query-provider')).toBeInTheDocument();
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders children text correctly', () => {
        render(
            <ReactQueryProvider>
                <span>Hello World</span>
            </ReactQueryProvider>
        );

        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
});
