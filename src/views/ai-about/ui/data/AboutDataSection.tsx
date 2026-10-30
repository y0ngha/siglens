import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { DataTile } from '../../lib/aboutSections';
import { AboutSection } from '../AboutSection';
import { AboutDataTile } from './AboutDataTile';

interface Props {
    readonly title: string;
    readonly body: string;
    /** The example question at the top of the flow. */
    readonly question: string;
    /** The example answer at the bottom of the flow. */
    readonly answer: string;
    /** The lookups and as-of time shown under the example answer. */
    readonly chips: readonly string[];
    readonly tiles: readonly DataTile[];
}

/** Decorative down arrow joining the steps of the question → data → answer flow. */
function FlowArrow() {
    return (
        <span
            aria-hidden="true"
            className="relative h-6 w-0.5 bg-secondary-600 after:absolute after:-bottom-px after:-left-1 after:border-x-[5px] after:border-t-[7px] after:border-x-transparent after:border-t-secondary-600"
        />
    );
}

/**
 * The data section, drawn as a flow: an example question, the data sources
 * SIGLENS AI looks up, then the answer they produce.
 */
export function AboutDataSection({
    title,
    body,
    question,
    answer,
    chips,
    tiles,
}: Props) {
    return (
        <AboutSection id="about-data" title={title} sub={body}>
            <div className="mt-8 flex flex-col items-center gap-3">
                <p
                    className={cn(
                        SURFACE_CARD,
                        'max-w-sm px-4 py-2.5 text-sm text-secondary-100'
                    )}
                >
                    {question}
                </p>
                <FlowArrow />
                <ul className="grid w-full gap-3 sm:grid-cols-2">
                    {tiles.map(tile => (
                        <AboutDataTile key={tile.id} tile={tile} />
                    ))}
                </ul>
                <FlowArrow />
                <div className="max-w-sm rounded-lg border border-secondary-600 bg-secondary-800 px-4 py-3 text-sm leading-6 text-secondary-200">
                    {answer}
                    <p className="mt-2 flex flex-wrap gap-1 text-xs">
                        {chips.map(label => (
                            <span
                                key={label}
                                className="rounded bg-secondary-700/40 px-1.5 py-0.5 text-secondary-300"
                            >
                                {label}
                            </span>
                        ))}
                    </p>
                </div>
            </div>
        </AboutSection>
    );
}
