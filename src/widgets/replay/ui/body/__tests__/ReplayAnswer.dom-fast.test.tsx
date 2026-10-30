import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    parseReplayLine,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';
import { completeFrame, type Frame } from '@/widgets/replay/utils/replayPlayer';
import { deriveReplayView } from '@/widgets/replay/utils/replayView';
import { ReplayAnswer } from '@/widgets/replay/ui/body/ReplayAnswer';

const SCENARIOS: readonly ReplayScenario[] = [
    {
        id: 'a',
        question: 'AAPL',
        tools: [
            {
                label: 'Chart',
                pendingLabel: 'Loading chart',
                subject: 'daily',
                ms: 500,
            },
        ],
        lines: [parseReplayLine('p', 'Trending up.')],
        summary: 'Analyzed in 1 step',
        sources: ['Chart'],
        asOf: 'As of close',
    },
];

const renderAnswer = (frame: Frame) =>
    render(
        <ReplayAnswer
            view={deriveReplayView(SCENARIOS, frame)}
            frame={frame}
            doneIcon={null}
            sourcesLabel="Based on"
            sourcesSeparator={false}
        />
    );

describe('ReplayAnswer', () => {
    it('streams the body without the sources line until playback finishes', () => {
        renderAnswer({
            index: 0,
            typed: 4,
            toolsShown: 0,
            toolsDone: 0,
            summary: true,
            chars: 5,
            sources: false,
        });
        expect(screen.getByText('Trend')).toBeInTheDocument();
        expect(screen.queryByText('Based on')).not.toBeInTheDocument();
    });

    it('shows summary, full body and sources on the complete frame', () => {
        const { container } = renderAnswer(completeFrame(0));
        expect(container.textContent).toBe(
            'Analyzed in 1 stepTrending up.Based onChartAs of close'
        );
    });
});
