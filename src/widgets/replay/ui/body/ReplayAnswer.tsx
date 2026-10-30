/** Everything below a replay's input: progress row, streamed body and sources. */

import type { ReactNode } from 'react';
import type { Frame } from '@/widgets/replay/utils/replayPlayer';
import type { ReplayView } from '@/widgets/replay/utils/replayView';
import { ReplayLines } from '@/widgets/replay/ui/body/ReplayLines';
import { ReplayProgress } from '@/widgets/replay/ui/body/ReplayProgress';
import { ReplaySources } from '@/widgets/replay/ui/body/ReplaySources';

interface ReplayAnswerProps {
    readonly view: ReplayView;
    readonly frame: Frame;
    readonly doneIcon: ReactNode;
    readonly sourcesLabel: string;
    readonly sourcesSeparator: boolean;
}

/**
 * Renders as siblings (a fragment) so each chrome keeps its own column
 * container — the chat bubble's column vs. the report card's body.
 */
export function ReplayAnswer({
    view,
    frame,
    doneIcon,
    sourcesLabel,
    sourcesSeparator,
}: ReplayAnswerProps) {
    const { scenario, reveal } = view;
    return (
        <>
            <ReplayProgress
                scenario={scenario}
                frame={frame}
                doneIcon={doneIcon}
            />
            {frame.summary ? (
                <ReplayLines lines={scenario.lines} reveal={reveal} />
            ) : null}
            {frame.sources ? (
                <ReplaySources
                    label={sourcesLabel}
                    sources={scenario.sources}
                    asOf={scenario.asOf}
                    separator={sourcesSeparator}
                />
            ) : null}
        </>
    );
}
