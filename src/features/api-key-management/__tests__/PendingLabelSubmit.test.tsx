import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFormStatus } from 'react-dom';

import { PendingLabelSubmit } from '@/features/api-key-management/ui/PendingLabelSubmit';

vi.mock('react-dom', async importOriginal => ({
    ...(await importOriginal<typeof import('react-dom')>()),
    useFormStatus: vi.fn(),
}));

const mockUseFormStatus = vi.mocked(useFormStatus);

function setPending(pending: boolean) {
    mockUseFormStatus.mockReturnValue(
        pending
            ? {
                  pending: true,
                  data: new FormData(),
                  method: 'post',
                  action: '/save',
              }
            : { pending: false, data: null, method: null, action: null }
    );
}

function renderSubmit(onSubmit: () => void = vi.fn()) {
    return render(
        <form
            onSubmit={event => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <PendingLabelSubmit
                label="저장"
                pendingLabel="저장 중..."
                className="test"
                aria-describedby="status-id"
            />
        </form>
    );
}

describe('PendingLabelSubmit', () => {
    describe('when the form is not pending', () => {
        beforeEach(() => setPending(false));

        it('shows the label', () => {
            renderSubmit();
            expect(screen.getByRole('button', { name: '저장' })).toBeVisible();
        });

        it('does not set aria-disabled', () => {
            renderSubmit();
            expect(screen.getByRole('button')).not.toHaveAttribute(
                'aria-disabled'
            );
        });

        it('submits the form on click', async () => {
            const onSubmit = vi.fn();
            renderSubmit(onSubmit);
            await userEvent.setup().click(screen.getByRole('button'));
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });

        it('forwards aria-describedby', () => {
            renderSubmit();
            expect(screen.getByRole('button')).toHaveAttribute(
                'aria-describedby',
                'status-id'
            );
        });
    });

    describe('when the form is pending', () => {
        beforeEach(() => setPending(true));

        it('shows the pending label instead of the label', () => {
            renderSubmit();
            expect(
                screen.getByRole('button', { name: '저장 중...' })
            ).toBeVisible();
        });

        it('sets aria-disabled to true', () => {
            renderSubmit();
            expect(screen.getByRole('button')).toHaveAttribute(
                'aria-disabled',
                'true'
            );
        });

        it('sets aria-busy to true', () => {
            renderSubmit();
            expect(screen.getByRole('button')).toHaveAttribute(
                'aria-busy',
                'true'
            );
        });

        it('stays focusable instead of using the disabled attribute', () => {
            renderSubmit();
            expect(screen.getByRole('button')).not.toBeDisabled();
        });

        it('blocks the click so the form is not submitted again', async () => {
            const onSubmit = vi.fn();
            renderSubmit(onSubmit);
            await userEvent.setup().click(screen.getByRole('button'));
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it('forwards aria-describedby', () => {
            renderSubmit();
            expect(screen.getByRole('button')).toHaveAttribute(
                'aria-describedby',
                'status-id'
            );
        });
    });
});
