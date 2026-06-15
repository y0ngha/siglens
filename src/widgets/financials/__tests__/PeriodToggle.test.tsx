// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PeriodToggle } from '../PeriodToggle';

describe('PeriodToggle', () => {
    it('renders annual and quarter buttons', () => {
        render(<PeriodToggle value="annual" onChange={vi.fn()} />);
        expect(
            screen.getByRole('button', { name: '연간' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '분기' })
        ).toBeInTheDocument();
    });

    it('marks the active period button with aria-pressed=true', () => {
        render(<PeriodToggle value="annual" onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: '연간' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        expect(screen.getByRole('button', { name: '분기' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('marks quarter as active when value is quarter', () => {
        render(<PeriodToggle value="quarter" onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: '연간' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        expect(screen.getByRole('button', { name: '분기' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('calls onChange with "quarter" when quarter button is clicked', () => {
        const onChange = vi.fn();
        render(<PeriodToggle value="annual" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: '분기' }));
        expect(onChange).toHaveBeenCalledWith('quarter');
    });

    it('calls onChange with "annual" when annual button is clicked', () => {
        const onChange = vi.fn();
        render(<PeriodToggle value="quarter" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: '연간' }));
        expect(onChange).toHaveBeenCalledWith('annual');
    });

    it('is wrapped in a group role with accessible label', () => {
        render(<PeriodToggle value="annual" onChange={vi.fn()} />);
        expect(
            screen.getByRole('group', { name: '조회 기간' })
        ).toBeInTheDocument();
    });
});
