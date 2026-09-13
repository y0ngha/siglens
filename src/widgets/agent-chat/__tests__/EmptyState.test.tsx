import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/widgets/agent-chat/EmptyState';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

describe('EmptyState', () => {
    it('prefers AI suggestions and sends the clicked one', () => {
        const onPick = vi.fn();
        wrap(
            <EmptyState
                onPick={onPick}
                signedIn
                loginHref="/login"
                suggestions={['오늘 시장 어때?', 'NVDA 뉴스 요약']}
            />
        );
        const list = screen.getByRole('list', {
            name: '이렇게 물어볼 수 있어요',
        });
        expect(list.querySelectorAll('li')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: /NVDA 뉴스 요약/ }));
        expect(onPick).toHaveBeenCalledWith('NVDA 뉴스 요약');
    });

    it('falls back to the six static suggestions when none are provided', () => {
        wrap(
            <EmptyState
                onPick={vi.fn()}
                signedIn
                loginHref="/login"
                suggestions={null}
            />
        );
        expect(screen.getAllByRole('button')).toHaveLength(6);
        expect(
            screen.getByRole('button', { name: /내 보유 종목 지금 어때/ })
        ).toBeInTheDocument();
    });

    it('signed out: a login CTA, and the example questions lead to login instead of sending', () => {
        const onPick = vi.fn();
        wrap(
            <EmptyState
                onPick={onPick}
                signedIn={false}
                loginHref="https://siglens.io/login?next=x"
                suggestions={['무시돼야 할 개인화 제안']}
            />
        );
        expect(
            screen.getByRole('link', { name: /siglens 계정으로 로그인/ })
        ).toHaveAttribute('href', 'https://siglens.io/login?next=x');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'SiglensAI'
        );
        const examples = screen.getByRole('list', {
            name: '이런 질문에 답할 수 있어요',
        });
        const links = examples.querySelectorAll('a');
        expect(links).toHaveLength(6);
        links.forEach(a =>
            expect(a).toHaveAttribute('href', 'https://siglens.io/login?next=x')
        );
        expect(screen.queryByText('무시돼야 할 개인화 제안')).toBeNull();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('carries the brand: Beta tag and what the assistant looks up', () => {
        wrap(<EmptyState onPick={vi.fn()} signedIn loginHref="/login" />);
        expect(screen.getByText('Beta')).toHaveAttribute('translate', 'no');
        expect(
            screen.getByRole('list', { name: 'SiglensAI가 찾아보는 데이터' })
        ).toHaveTextContent('실시간 시세');
    });
});
