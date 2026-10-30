import { isInaccessible, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MethodStepCard } from '../../ui/method/MethodStepCard';

const STEP = { title: 'Read the chart', body: 'Every indicator is computed.' };

describe('MethodStepCard', () => {
    it('names the h3 by the step title alone', () => {
        render(<MethodStepCard step={STEP} number={2} />);
        expect(screen.getByRole('heading', { level: 3 })).toHaveAccessibleName(
            'Read the chart'
        );
    });

    it('keeps the decorative step number out of the accessibility tree', () => {
        render(<MethodStepCard step={STEP} number={2} />);
        expect(isInaccessible(screen.getByText('2'))).toBe(true);
    });
});
