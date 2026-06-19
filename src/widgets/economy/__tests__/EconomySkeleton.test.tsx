import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { EconomySkeleton } from '@/widgets/economy/sections/EconomySkeleton';

describe('EconomySkeleton', () => {
    it('renders with role=status and aria-busy=true', () => {
        render(<EconomySkeleton />);
        const root = screen.getByRole('status');
        expect(root).toBeInTheDocument();
        expect(root).toHaveAttribute('aria-busy', 'true');
        expect(root).toHaveAttribute('aria-label', '경제 지표 로딩 중');
    });

    it('renders animate-pulse decorative regions (aria-hidden)', () => {
        const { container } = render(<EconomySkeleton />);
        // macro-facts section + briefing section + grid wrapper div + calendar section = 4 aria-hidden regions
        const hiddenRegions = container.querySelectorAll(
            '[aria-hidden="true"]'
        );
        expect(hiddenRegions.length).toBe(4);
        // All top-level pulse blocks carry animate-pulse
        const pulseBlocks = container.querySelectorAll('.animate-pulse');
        // macro-facts card + briefing card + 4 indicator cards + calendar card = 7 pulse blocks
        expect(pulseBlocks.length).toBe(7);
    });
});
