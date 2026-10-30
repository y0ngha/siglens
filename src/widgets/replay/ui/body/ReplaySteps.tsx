/** The lookup / analysis step chips that light up one by one during a replay. */

import { cn } from '@/shared/lib/cn';
import type { ReplayTool } from '@/shared/lib/replay/replayScript';

interface ReplayStepsProps {
    readonly tools: readonly ReplayTool[];
    /** How many of `tools` have finished. */
    readonly done: number;
}

/** Pending steps pulse with their in-progress label; finished ones turn green. */
export function ReplaySteps({ tools, done }: ReplayStepsProps) {
    return (
        <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool, t) => {
                const finished = t < done;
                return (
                    <li
                        key={tool.label}
                        className={cn(
                            'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs',
                            finished
                                ? 'border-secondary-700 text-secondary-400'
                                : 'border-border-control text-secondary-200'
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-1.5 rounded-full',
                                finished
                                    ? 'bg-ui-success'
                                    : 'bg-secondary-300 motion-safe:animate-pulse'
                            )}
                        />
                        {finished ? tool.label : tool.pendingLabel}
                        <span className="text-secondary-400 tabular-nums">
                            {tool.subject}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
