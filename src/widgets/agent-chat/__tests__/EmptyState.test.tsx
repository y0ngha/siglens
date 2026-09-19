import { act, fireEvent, render, screen } from '@testing-library/react';
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
    it('prefers AI suggestions and sends the clicked one', async () => {
        const onPick = vi.fn();
        await act(async () => {
            wrap(
                <EmptyState
                    localePrefix=""
                    onPick={onPick}
                    signedIn
                    loginHref="/login"
                    suggestions={Promise.resolve([
                        '오늘 시장 어때?',
                        'NVDA 뉴스 요약',
                    ])}
                />
            );
        });
        const list = await screen.findByRole('list', {
            name: '이렇게 물어볼 수 있어요',
        });
        expect(list.querySelectorAll('li')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: /NVDA 뉴스 요약/ }));
        expect(onPick).toHaveBeenCalledWith('NVDA 뉴스 요약');
    });

    /**
     * The landing must not wait for generation (up to 8s on a cache miss): the
     * rest of the page renders while six same-size placeholders hold the spot.
     */
    it('renders the page with placeholders while suggestions are still generating', () => {
        wrap(
            <EmptyState
                localePrefix=""
                onPick={vi.fn()}
                signedIn
                loginHref="/login"
                suggestions={new Promise(() => {})}
            />
        );
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /어떻게 답하는지/ })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /내 보유 종목 지금 어때/ })
        ).toBeNull();
    });

    it('falls back to the static six when generation yields nothing', async () => {
        await act(async () => {
            wrap(
                <EmptyState
                    localePrefix=""
                    onPick={vi.fn()}
                    signedIn
                    loginHref="/login"
                    suggestions={Promise.resolve(null)}
                />
            );
        });
        expect(
            await screen.findByRole('button', {
                name: /내 보유 종목 지금 어때/,
            })
        ).toBeInTheDocument();
    });

    it('falls back to the six static suggestions when none are provided', () => {
        wrap(
            <EmptyState
                localePrefix=""
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

    it('signed out: the example questions send right away, with one quiet line on what login adds', () => {
        const onPick = vi.fn();
        wrap(
            <EmptyState
                localePrefix=""
                onPick={onPick}
                signedIn={false}
                loginHref="https://siglens.io/login?next=x"
                suggestions={Promise.resolve(['무시돼야 할 개인화 제안'])}
            />
        );
        expect(
            screen.getByRole('link', { name: /SIGLENS 계정으로 로그인/ })
        ).toHaveAttribute('href', 'https://siglens.io/login?next=x');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'SIGLENS AI'
        );
        const examples = screen.getByRole('list', {
            name: '이런 질문에 답할 수 있어요',
        });
        const buttons = examples.querySelectorAll('button');
        expect(buttons).toHaveLength(6);
        expect(examples.querySelectorAll('a')).toHaveLength(0);
        buttons[0]!.click();
        expect(onPick).toHaveBeenCalledWith('내 보유 종목 지금 어때?');
        // Personalised suggestions are for members; guests get the static six.
        expect(screen.queryByText('무시돼야 할 개인화 제안')).toBeNull();
        expect(
            screen.getByText(/로그인 없이 바로 물어볼 수 있어요/)
        ).toBeInTheDocument();
    });

    it('carries the brand: Beta tag and what the assistant looks up', () => {
        wrap(
            <EmptyState
                localePrefix=""
                onPick={vi.fn()}
                signedIn
                loginHref="/login"
            />
        );
        expect(screen.getByText('Beta')).toHaveAttribute('translate', 'no');
        expect(
            screen.getByRole('list', { name: 'SIGLENS AI가 찾아보는 데이터' })
        ).toHaveTextContent('최신 시세');
    });

    it('leaves how-it-works to /about: one link there, none of the old landing sections', () => {
        wrap(
            <EmptyState
                localePrefix="/en"
                onPick={vi.fn()}
                signedIn={false}
                loginHref="/login"
            />
        );
        expect(
            screen.getByRole('link', {
                name: /SIGLENS AI가 어떻게 답하는지 보기/,
            })
        ).toHaveAttribute('href', '/en/about');
        for (const name of ['답변은 어디서 오나요', '자주 묻는 질문'])
            expect(
                screen.queryByRole('heading', { level: 2, name })
            ).toBeNull();
        // The h1's two parts read as two phrases, not one run-on word.
        expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
            /요 \S/
        );
    });
});
