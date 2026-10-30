import { render } from '@testing-library/react';

import { useApiKeyForms } from '@/features/api-key-management/hooks/useApiKeyForms';
import { ProviderCard } from '@/features/api-key-management/ui/ProviderCard';

vi.mock('@/features/api-key-management/hooks/useApiKeyForms');

const mockUseApiKeyForms = vi.mocked(useApiKeyForms);

type OnSuccess = NonNullable<Parameters<typeof useApiKeyForms>[0]>['onSuccess'];

const IDLE = { status: 'idle', message: null } as const;

/** 카드가 `useApiKeyForms`에 넘긴 `onSuccess`를 붙잡아 돌려준다. */
function renderCard(isRegistered: boolean) {
    const onRegistrationChange = vi.fn();
    let captured: OnSuccess | undefined;
    mockUseApiKeyForms.mockImplementation(options => {
        captured = options?.onSuccess;
        return {
            saveState: IDLE,
            saveFormAction: vi.fn(),
            isSavePending: false,
            deleteState: IDLE,
            deleteFormAction: vi.fn(),
            isDeletePending: false,
        };
    });
    render(
        <ProviderCard
            provider="anthropic"
            isRegistered={isRegistered}
            restoreFocus={false}
            onFocusRestored={vi.fn()}
            onRegistrationChange={onRegistrationChange}
        />
    );
    return {
        onRegistrationChange,
        succeed: (kind: 'save' | 'delete') => captured?.(kind),
    };
}

describe('ProviderCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('onRegistrationChange on success', () => {
        describe('when an unregistered provider saves', () => {
            it('reports the provider as registered', () => {
                const { onRegistrationChange, succeed } = renderCard(false);
                succeed('save');
                expect(onRegistrationChange).toHaveBeenCalledWith(
                    'anthropic',
                    true
                );
            });
        });

        describe('when a registered provider is deleted', () => {
            it('reports the provider as unregistered', () => {
                const { onRegistrationChange, succeed } = renderCard(true);
                succeed('delete');
                expect(onRegistrationChange).toHaveBeenCalledWith(
                    'anthropic',
                    false
                );
            });
        });

        describe('when a registered provider is re-registered', () => {
            it('does not report a change', () => {
                const { onRegistrationChange, succeed } = renderCard(true);
                succeed('save');
                expect(onRegistrationChange).not.toHaveBeenCalled();
            });
        });

        describe('when an unregistered provider deletes', () => {
            it('does not report a change', () => {
                const { onRegistrationChange, succeed } = renderCard(false);
                succeed('delete');
                expect(onRegistrationChange).not.toHaveBeenCalled();
            });
        });
    });
});
