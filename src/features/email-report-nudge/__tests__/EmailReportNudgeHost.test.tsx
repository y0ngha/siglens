const hook = vi.hoisted(() => ({
    nudge: null as unknown,
    close: vi.fn(),
}));

vi.mock('@/features/email-report-nudge/hooks/useEmailReportNudge', () => ({
    useEmailReportNudge: () => ({ nudge: hook.nudge, close: hook.close }),
}));
vi.mock('@/features/email-report-nudge/ui/EmailReportNudgeModal', () => ({
    EmailReportNudgeModal: ({
        nudge,
        onClose,
    }: {
        nudge: { kind: string };
        onClose: () => void;
    }) => (
        <div role="dialog" data-kind={nudge.kind}>
            <button type="button" onClick={onClose}>
                close
            </button>
        </div>
    ),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { EmailReportNudgeHost } from '@/features/email-report-nudge/ui/EmailReportNudgeHost';

describe('EmailReportNudgeHost', () => {
    beforeEach(() => {
        hook.nudge = null;
        hook.close.mockReset();
    });

    it('띄울 넛지가 없으면 아무것도 그리지 않는다', () => {
        const { container } = render(<EmailReportNudgeHost />);

        expect(container).toBeEmptyDOMElement();
    });

    it('넛지가 있으면 그 종류로 모달을 그리고 닫기를 훅에 연결한다', () => {
        hook.nudge = { kind: 'setup', symbolCount: 2 };
        render(<EmailReportNudgeHost />);

        expect(screen.getByRole('dialog')).toHaveAttribute(
            'data-kind',
            'setup'
        );
        fireEvent.click(screen.getByRole('button', { name: 'close' }));
        expect(hook.close).toHaveBeenCalledTimes(1);
    });
});
