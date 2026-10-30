import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ko from '../../../../../messages/ko.json';
import { StreamErrorBanner } from '@/widgets/agent-chat/shell/StreamErrorBanner';

const labels = ko.widgets['agent-chat'].ChatShell;

function setup(offerLogin: boolean, retryable: boolean) {
    const onRetry = vi.fn();
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <StreamErrorBanner
                message="문제가 생겼어요"
                offerLogin={offerLogin}
                retryable={retryable}
                loginHref="/login?next=/c/c1"
                onRetry={onRetry}
            />
        </NextIntlClientProvider>
    );
    return { onRetry };
}

describe('StreamErrorBanner', () => {
    it('문구를 경고(alert)로 알린다', () => {
        setup(false, false);
        expect(screen.getByRole('alert')).toHaveTextContent('문제가 생겼어요');
    });

    describe('로그인을 권할 때', () => {
        it('로그인 링크만 보이고 재시도 버튼은 없다 — 다시 시도해도 같은 오류다', () => {
            setup(true, true);
            expect(
                screen.getByRole('link', { name: labels.loginCta })
            ).toHaveAttribute('href', '/login?next=/c/c1');
            expect(
                screen.queryByRole('button', { name: labels['548fe0'] })
            ).toBeNull();
        });
    });

    describe('다시 시도할 수 있을 때', () => {
        it('재시도 버튼이 onRetry를 부른다', () => {
            const { onRetry } = setup(false, true);
            fireEvent.click(
                screen.getByRole('button', { name: labels['548fe0'] })
            );
            expect(onRetry).toHaveBeenCalledOnce();
            expect(screen.queryByRole('link')).toBeNull();
        });
    });

    describe('다음 길이 없을 때', () => {
        it('버튼·링크 없이 문구만 보인다', () => {
            setup(false, false);
            expect(screen.queryByRole('button')).toBeNull();
            expect(screen.queryByRole('link')).toBeNull();
        });
    });
});
