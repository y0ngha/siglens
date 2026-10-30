import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    parseReplayLine,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';
import { completeFrame, type Frame } from '@/widgets/replay/utils/replayPlayer';
import { ReplayProgress } from '@/widgets/replay/ui/body/ReplayProgress';

const SCENARIO: ReplayScenario = {
    id: 'a',
    question: 'AAPL',
    tools: [
        {
            label: 'Chart',
            pendingLabel: 'Loading chart',
            subject: 'daily',
            ms: 500,
        },
        {
            label: 'News',
            pendingLabel: 'Loading news',
            subject: '7 days',
            ms: 500,
        },
    ],
    lines: [parseReplayLine('p', 'Body')],
    summary: 'Analyzed in 2 steps',
    sources: ['Chart'],
    asOf: 'As of close',
};

const frameAt = (patch: Partial<Frame>): Frame => ({
    index: 0,
    typed: 4,
    toolsShown: 0,
    toolsDone: 0,
    summary: false,
    chars: 0,
    sources: false,
    ...patch,
});

const renderProgress = (frame: Frame) =>
    render(
        <ReplayProgress
            scenario={SCENARIO}
            frame={frame}
            doneIcon={<span data-testid="done" />}
        />
    );

describe('ReplayProgress', () => {
    it('renders nothing before the first step lights up', () => {
        const { container } = renderProgress(frameAt({}));
        expect(container).toBeEmptyDOMElement();
    });

    it('shows only the steps lit so far while they run', () => {
        renderProgress(frameAt({ toolsShown: 1, toolsDone: 0 }));
        expect(screen.getByText('Loading chart')).toBeInTheDocument();
        expect(screen.queryByText('Loading news')).not.toBeInTheDocument();
        expect(
            screen.queryByText('Analyzed in 2 steps')
        ).not.toBeInTheDocument();
    });

    it('folds the steps into the summary line with the done icon', () => {
        renderProgress(completeFrame(0));
        expect(screen.getByText('Analyzed in 2 steps')).toBeInTheDocument();
        expect(screen.getByTestId('done')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
});
