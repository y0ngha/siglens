import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReplayCaret } from '@/widgets/replay/ui/body/ReplayCaret';

describe('ReplayCaret', () => {
    it('renders a decorative caret that pulses only with motion allowed', () => {
        const { container } = render(<ReplayCaret />);
        const caret = container.firstElementChild;
        expect(caret).toHaveAttribute('aria-hidden', 'true');
        expect(caret).toHaveClass('motion-safe:animate-pulse');
    });
});
