import { describe, expect, it } from 'vitest';
import {
    parseReplayLine,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';
import { completeFrame, type Frame } from '@/widgets/replay/utils/replayPlayer';
import { deriveReplayView } from '@/widgets/replay/utils/replayView';

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
        lines: [parseReplayLine('p', 'abc'), parseReplayLine('p', 'de')],
        summary: 'Analyzed',
        sources: ['Chart'],
        asOf: 'As of close',
    },
];

const frameAt = (patch: Partial<Frame>): Frame => ({
    index: 0,
    typed: 0,
    toolsShown: 0,
    toolsDone: 0,
    summary: false,
    chars: 0,
    sources: false,
    ...patch,
});

describe('deriveReplayView', () => {
    it('shows the typed prefix with a caret while the question is typed', () => {
        const view = deriveReplayView(SCENARIOS, frameAt({ typed: 2 }));
        expect(view.typedQuestion).toBe('AA');
        expect(view.typing).toBe(true);
        expect(view.answerStarted).toBe(false);
    });

    it('drops the caret and starts the answer once the first step lights up', () => {
        const view = deriveReplayView(
            SCENARIOS,
            frameAt({ typed: 4, toolsShown: 1 })
        );
        expect(view.typedQuestion).toBe('AAPL');
        expect(view.typing).toBe(false);
        expect(view.answerStarted).toBe(true);
    });

    it('keeps the body hidden until the summary folds in, even with chars set', () => {
        const view = deriveReplayView(
            SCENARIOS,
            frameAt({ typed: 4, toolsShown: 1, chars: 4 })
        );
        expect(view.reveal).toEqual([
            { shown: 0, caret: false },
            { shown: 0, caret: false },
        ]);
    });

    it('streams the body with the caret on the last revealed line', () => {
        const view = deriveReplayView(
            SCENARIOS,
            frameAt({ typed: 4, summary: true, chars: 4 })
        );
        expect(view.reveal).toEqual([
            { shown: 3, caret: false },
            { shown: 1, caret: true },
        ]);
    });

    it('shows everything with no caret on the complete frame', () => {
        const view = deriveReplayView(SCENARIOS, completeFrame(0));
        expect(view.typing).toBe(false);
        expect(view.reveal).toEqual([
            { shown: 3, caret: false },
            { shown: 2, caret: false },
        ]);
    });
});
