import { render, screen } from '@testing-library/react';
import { SuccessNotice } from '@/shared/ui/SuccessNotice';

const props = { title: 'Sent', messages: ['First line', 'Second line'] };

describe('SuccessNotice', () => {
    it('keeps an empty live region mounted before success', () => {
        render(<SuccessNotice show={false} {...props} />);
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('fills the same live region and focuses the panel once shown', () => {
        const { rerender } = render(<SuccessNotice show={false} {...props} />);
        const liveRegion = screen.getByRole('status');

        rerender(<SuccessNotice show {...props} />);

        expect(screen.getByRole('status')).toBe(liveRegion);
        expect(screen.getByText('Sent')).toBeInTheDocument();
        expect(screen.getByText('First line')).toBeInTheDocument();
        expect(screen.getByText('Second line')).toBeInTheDocument();
        expect(liveRegion.firstElementChild).toHaveFocus();
    });
});
