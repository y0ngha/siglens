import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import ko from '../../../../../messages/ko.json';
import { useAgentErrorCopy } from '@/widgets/agent-chat/hooks/useAgentErrorCopy';
import { AGENT_ERROR_RETRYABLE } from '@/widgets/agent-chat/utils/errorCopy';
import { GUEST_TURNS_PER_DAY } from '@/widgets/agent-chat/utils/guestTurnLimit';

const copy = ko.widgets['agent-chat'].ChatShell;

const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="ko" messages={ko}>
        {children}
    </NextIntlClientProvider>
);

const run = (error: string | null, signedIn: boolean) =>
    renderHook(() => useAgentErrorCopy(error, signedIn), { wrapper }).result
        .current;

describe('useAgentErrorCopy', () => {
    describe('no error', () => {
        it('has no message, is not retryable and offers no login', () => {
            expect(run(null, true)).toEqual({
                message: null,
                retryable: false,
                offerLogin: false,
            });
        });
    });

    describe('known codes', () => {
        it('maps a code to its catalog message', () => {
            expect(run('server_busy', true).message).toBe(copy.errorServerBusy);
        });

        it.each(Object.keys(AGENT_ERROR_RETRYABLE))(
            'takes retryable for %s from the retry table',
            code => {
                expect(run(code, true).retryable).toBe(
                    AGENT_ERROR_RETRYABLE[
                        code as keyof typeof AGENT_ERROR_RETRYABLE
                    ]
                );
            }
        );
    });

    describe('unknown code', () => {
        it('falls back to the generic message', () => {
            expect(run('totally_new', true).message).toBe(copy.errorGeneric);
        });

        it('is retryable', () => {
            expect(run('totally_new', true).retryable).toBe(true);
        });
    });

    describe('turn_limit', () => {
        it('shows the signed-in message for a member', () => {
            expect(run('turn_limit', true).message).toBe(copy.errorTurnLimit);
        });

        it('shows the guest message with the daily guest limit', () => {
            expect(run('turn_limit', false).message).toBe(
                copy.errorTurnLimitGuest.replace(
                    '{n}',
                    String(GUEST_TURNS_PER_DAY)
                )
            );
        });

        it('offers login only to a guest', () => {
            expect(run('turn_limit', false).offerLogin).toBe(true);
        });

        it('does not offer login to a member', () => {
            expect(run('turn_limit', true).offerLogin).toBe(false);
        });

        it('is not retryable', () => {
            expect(run('turn_limit', false).retryable).toBe(false);
        });
    });

    describe('other codes for a guest', () => {
        it('do not offer login', () => {
            expect(run('server_busy', false).offerLogin).toBe(false);
        });
    });
});
