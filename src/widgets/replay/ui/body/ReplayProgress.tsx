/** The progress row above a replay's body: the live steps, then their folded summary. */

import type { ReactNode } from 'react';
import type { ReplayScenario } from '@/shared/lib/replay/replayScript';
import type { Frame } from '@/widgets/replay/utils/replayPlayer';
import { ReplaySteps } from '@/widgets/replay/ui/body/ReplaySteps';

interface ReplayProgressProps {
    readonly scenario: ReplayScenario;
    readonly frame: Frame;
    readonly doneIcon: ReactNode;
}

/**
 * Nothing before the first step lights up, the step chips while they run,
 * then one summary line once the body starts streaming.
 */
export function ReplayProgress({
    scenario,
    frame,
    doneIcon,
}: ReplayProgressProps) {
    if (frame.summary) {
        return (
            <p className="flex items-center gap-1.5 text-xs text-secondary-400">
                {doneIcon}
                {scenario.summary}
            </p>
        );
    }
    if (frame.toolsShown === 0) return null;
    return (
        <ReplaySteps
            tools={scenario.tools.slice(0, frame.toolsShown)}
            done={frame.toolsDone}
        />
    );
}
