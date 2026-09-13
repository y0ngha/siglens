import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { ToolActivity } from '@/widgets/agent-chat/ToolActivity';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

const done = [
    {
        id: 'a',
        name: 'get_quote',
        args: { symbol: 'AAPL' },
        status: 'ok' as const,
        ms: 1200,
        summary: '{"price":1}',
    },
    { id: 'b', name: 'get_news', args: {}, status: 'ok' as const, ms: 2000 },
];

describe('ToolActivity', () => {
    it('renders nothing without tools', () => {
        const { container } = wrap(<ToolActivity tools={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('folds finished tools into one summary that still names every tool, and expands to chips on click', () => {
        wrap(<ToolActivity tools={done} />);
        const summary = screen.getByRole('button', { expanded: false });
        expect(summary).toHaveTextContent(
            '도구 2개 사용 · get_quote, get_news · 3.2s'
        );
        // Collapsed: the name appears exactly once (the E2E suite counts on this).
        expect(screen.getAllByText(/get_quote/)).toHaveLength(1);
        fireEvent.click(summary);
        expect(summary).toHaveAttribute('aria-expanded', 'true');
        expect(
            screen.getByRole('list', { name: '사용한 도구' })
        ).toBeInTheDocument();
        expect(screen.getByText('get_quote AAPL')).toBeInTheDocument();
        // A chip opens its result preview.
        fireEvent.click(screen.getByText('get_quote AAPL'));
        expect(screen.getByText('{"price":1}')).toBeInTheDocument();
    });

    it('shows the running tool and its estimate in the summary while a call is in flight', () => {
        wrap(
            <ToolActivity
                tools={[
                    {
                        id: 'r',
                        name: 'run_fresh_analysis',
                        args: { symbol: 'NVDA' },
                        status: 'running',
                        estimatedSeconds: 90,
                    },
                ]}
            />
        );
        expect(screen.getByRole('button')).toHaveTextContent(
            '도구 실행 중 · run_fresh_analysis NVDA · 약 90초'
        );
    });

    it('marks a failed call in the summary colour', () => {
        wrap(
            <ToolActivity
                tools={[
                    {
                        id: 'e',
                        name: 'get_news',
                        args: {},
                        status: 'error',
                        ms: 10,
                    },
                ]}
            />
        );
        expect(screen.getByRole('button').className).toMatch(
            /text-ui-danger-text/
        );
    });
});
