import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseReplayLine, revealLines } from '@/shared/lib/replay/replayScript';
import { ReplayLines } from '@/widgets/replay/ui/body/ReplayLines';

describe('ReplayLines', () => {
    it('groups consecutive bullet lines under one list and keeps paragraphs apart', () => {
        const lines = [
            parseReplayLine('p', 'Intro paragraph.'),
            parseReplayLine('li', 'First bullet'),
            parseReplayLine('li', 'Second bullet'),
            parseReplayLine('p', 'Closing paragraph.'),
        ];

        render(
            <ReplayLines
                lines={lines}
                reveal={revealLines(lines, 1000, false)}
            />
        );

        expect(screen.getAllByRole('list')).toHaveLength(1);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText('Intro paragraph.').tagName).toBe('P');
        expect(screen.getByText('Closing paragraph.').tagName).toBe('P');
        expect(screen.getByText('First bullet').tagName).toBe('LI');
    });

    it('reveals characters only up to the streamed cut point', () => {
        const lines = [
            parseReplayLine('p', 'Hello world'),
            parseReplayLine('p', 'Second line not yet shown'),
        ];

        render(
            <ReplayLines lines={lines} reveal={revealLines(lines, 5, true)} />
        );

        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
        expect(screen.queryByText(/Second line/)).not.toBeInTheDocument();
    });

    it('puts the caret on the streaming line and drops it once streaming ends', () => {
        const lines = [parseReplayLine('p', 'Streaming text')];
        const { container, rerender } = render(
            <ReplayLines lines={lines} reveal={revealLines(lines, 5, true)} />
        );
        expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(
            1
        );

        rerender(
            <ReplayLines lines={lines} reveal={revealLines(lines, 14, false)} />
        );
        expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(
            0
        );
    });

    it('skips a whole trailing group none of whose lines are revealed yet', () => {
        const lines = [
            parseReplayLine('p', 'Revealed paragraph'),
            parseReplayLine('li', 'Not yet revealed bullet'),
        ];

        render(
            <ReplayLines lines={lines} reveal={revealLines(lines, 5, true)} />
        );

        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('renders tagged runs as toned strong text and plain runs as text', () => {
        const lines = [
            parseReplayLine(
                'p',
                '<b>bold</b> <up>gain</up> <down>loss</down> plain'
            ),
        ];

        const { container } = render(
            <ReplayLines
                lines={lines}
                reveal={revealLines(lines, 100, false)}
            />
        );

        expect(screen.getByText('bold')).toHaveClass('text-secondary-50');
        expect(screen.getByText('gain')).toHaveClass('text-ui-success-text');
        expect(screen.getByText('loss')).toHaveClass('text-ui-danger-text');
        expect(container.querySelectorAll('strong')).toHaveLength(3);
        expect(container.textContent).toBe('bold gain loss plain');
    });
});
