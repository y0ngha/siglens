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

    it('folds finished tools into one localized summary — no function names, no raw payloads — and expands to a step list', () => {
        wrap(<ToolActivity tools={done} />);
        const summary = screen.getByRole('button', { expanded: false });
        expect(summary).toHaveTextContent('시세 · 뉴스 확인 · 3.2초');
        expect(screen.queryByText(/get_quote|get_news/)).toBeNull();
        fireEvent.click(summary);
        expect(summary).toHaveAttribute('aria-expanded', 'true');
        const list = screen.getByRole('list', { name: '사용한 도구' });
        expect(list).toHaveTextContent('시세');
        expect(list).toHaveTextContent('AAPL');
        expect(list).toHaveTextContent('1.2초');
        // The tool result preview (`summary`) is an internal payload: never rendered.
        expect(screen.queryByText('{"price":1}')).toBeNull();
    });

    it('shows the running lookup, its subject and the estimate while a call is in flight', () => {
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
            '새 분석 생성 NVDA 확인 중 · 약 90초'
        );
    });

    it('a search lookup shows its query, an unknown tool a generic label', () => {
        wrap(
            <ToolActivity
                tools={[
                    {
                        id: 'w',
                        name: 'web_search',
                        args: { query: '한국은행 기준금리' },
                        status: 'ok',
                        ms: 700,
                    },
                    {
                        id: 'x',
                        name: 'future_tool',
                        args: {},
                        status: 'ok',
                        ms: 10,
                    },
                ]}
            />
        );
        fireEvent.click(screen.getByRole('button'));
        const list = screen.getByRole('list', { name: '사용한 도구' });
        expect(list).toHaveTextContent('웹 검색“한국은행 기준금리”');
        expect(list).toHaveTextContent('데이터 조회');
    });

    it('a failed call marks the summary as partial and the step as failed', () => {
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
        const summary = screen.getByRole('button');
        expect(summary).toHaveTextContent('뉴스 확인 · 일부 실패');
        fireEvent.click(summary);
        expect(screen.getByText('실패')).toBeInTheDocument();
    });

    it('a lookup refused to a guest reads as "login required", not as a failure', () => {
        wrap(
            <ToolActivity
                tools={[
                    {
                        id: 'p',
                        name: 'get_my_portfolio',
                        args: {},
                        status: 'error',
                        ms: 3,
                        summary: '{"error":"login_required"}',
                    },
                ]}
            />
        );
        const summary = screen.getByRole('button');
        expect(summary).toHaveTextContent('로그인 필요');
        expect(summary).not.toHaveTextContent('일부 실패');
        fireEvent.click(summary);
        expect(screen.queryByText('실패')).toBeNull();
    });

    it('summary가 login_required를 부분 문자열로만 담아도(다른 error) 로그인 필요로 읽지 않는다', () => {
        wrap(
            <ToolActivity
                tools={[
                    {
                        id: 'f',
                        name: 'get_news',
                        args: {},
                        status: 'error',
                        ms: 3,
                        summary:
                            '{"error":"tool_failed","note":"login_required"}',
                    },
                ]}
            />
        );
        const summary = screen.getByRole('button');
        expect(summary).toHaveTextContent('일부 실패');
        expect(summary).not.toHaveTextContent('로그인 필요');
    });
});
