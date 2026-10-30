import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReplaySources } from '@/widgets/replay/ui/body/ReplaySources';

describe('ReplaySources', () => {
    it('renders the label, each source chip and the as-of time after a hidden divider', () => {
        const { container } = render(
            <ReplaySources
                label="Sources"
                sources={['FMP', 'SEC']}
                asOf="as of 2026-09-18 close"
            />
        );

        expect(screen.getByText('FMP')).toBeInTheDocument();
        expect(screen.getByText('SEC')).toBeInTheDocument();
        expect(container.textContent).toBe(
            'SourcesFMPSEC| as of 2026-09-18 close'
        );
        // Decorative: a screen reader should not read out "vertical line".
        expect(
            container.querySelector('[aria-hidden="true"]')
        ).toHaveTextContent('|');
    });

    it('leaves the divider out when separator is off', () => {
        const { container } = render(
            <ReplaySources
                label="Sources"
                sources={['FMP']}
                asOf="as of 2026-09-18 close"
                separator={false}
            />
        );

        expect(container.textContent).toBe('SourcesFMPas of 2026-09-18 close');
    });
});
