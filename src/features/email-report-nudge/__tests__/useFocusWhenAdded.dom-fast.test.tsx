import { render, screen } from '@testing-library/react';
import { useFocusWhenAdded } from '@/features/email-report-nudge/hooks/useFocusWhenAdded';

interface ProbeProps {
    added: boolean;
}

function Probe({ added }: ProbeProps) {
    const ref = useFocusWhenAdded<HTMLParagraphElement>(added);
    return (
        <p ref={ref} tabIndex={-1}>
            status
        </p>
    );
}

describe('useFocusWhenAdded', () => {
    it('false에서 true로 바뀌면 대상에 포커스를 옮긴다', () => {
        const { rerender } = render(<Probe added={false} />);

        rerender(<Probe added />);

        expect(screen.getByText('status')).toHaveFocus();
    });

    it('마운트 때 이미 true면 포커스를 옮기지 않는다', () => {
        render(<Probe added />);

        expect(screen.getByText('status')).not.toHaveFocus();
    });

    it('true에서 false로 바뀌어도 포커스를 옮기지 않는다', () => {
        const { rerender } = render(<Probe added />);

        rerender(<Probe added={false} />);

        expect(screen.getByText('status')).not.toHaveFocus();
    });
});
