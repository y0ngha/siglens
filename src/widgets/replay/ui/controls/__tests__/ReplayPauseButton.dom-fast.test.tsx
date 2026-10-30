import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReplayPauseButton } from '@/widgets/replay/ui/controls/ReplayPauseButton';

describe('ReplayPauseButton', () => {
    it('is named for the next action and carries no pressed state', () => {
        const { rerender } = render(
            <ReplayPauseButton
                paused={false}
                onToggle={vi.fn()}
                pauseLabel="Pause"
                resumeLabel="Play"
            />
        );
        expect(
            screen.getByRole('button', { name: 'Pause' })
        ).not.toHaveAttribute('aria-pressed');

        rerender(
            <ReplayPauseButton
                paused={true}
                onToggle={vi.fn()}
                pauseLabel="Pause"
                resumeLabel="Play"
            />
        );
        expect(
            screen.getByRole('button', { name: 'Play' })
        ).not.toHaveAttribute('aria-pressed');
    });

    it('calls onToggle when clicked', () => {
        const onToggle = vi.fn();
        render(
            <ReplayPauseButton
                paused={false}
                onToggle={onToggle}
                pauseLabel="Pause"
                resumeLabel="Play"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});
