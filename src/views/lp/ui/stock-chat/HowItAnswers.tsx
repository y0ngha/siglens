/**
 * `/lp/stock-chat`'s question-to-answer flow: a question, the steps the agent
 * takes, and the answer with its source chips.
 */
import { Fragment } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import type { HowDemo, HowStep } from '../../lib/types';
import { LpIconTile } from '../LpIconTile';
import { QUESTION_BUBBLE } from './questionBubble';

/** `AiAboutPage`'s down arrow between the question, the lookups and the answer. */
function Arrow() {
    return (
        <span
            aria-hidden="true"
            className="relative h-6 w-0.5 bg-secondary-600 after:absolute after:-bottom-px after:-left-1 after:border-x-[5px] after:border-t-[7px] after:border-x-transparent after:border-t-secondary-600"
        />
    );
}

interface HowItAnswersProps {
    readonly steps: readonly HowStep[];
    readonly demo: HowDemo;
}

/** The flow, top to bottom, joined by arrows. */
export function HowItAnswers({ steps, demo }: HowItAnswersProps) {
    return (
        <div className="mt-8 flex flex-col items-center gap-3">
            <p className={QUESTION_BUBBLE}>{demo.question}</p>
            <Arrow />
            <ul className="grid w-full gap-3 sm:grid-cols-3">
                {steps.map(({ Icon, title, body }) => (
                    <li key={title} className={cn(SURFACE_CARD, 'p-4 sm:p-5')}>
                        <LpIconTile Icon={Icon} />
                        <h3 className={cn('mt-3', HEADING_SUBSECTION)}>
                            {title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-secondary-300">
                            {body}
                        </p>
                    </li>
                ))}
            </ul>
            <Arrow />
            <div className="max-w-sm rounded-lg border border-secondary-600 bg-secondary-800 px-4 py-3 text-sm leading-6 text-secondary-200">
                {demo.answer}
                <p className="mt-2 flex flex-wrap gap-1 text-xs">
                    {/* A space between chips keeps them apart in the text; the gap is visual only. */}
                    {demo.chips.map((label, i) => (
                        <Fragment key={label}>
                            {i > 0 && ' '}
                            <span className="rounded bg-secondary-700/40 px-1.5 py-0.5 text-secondary-300">
                                {label}
                            </span>
                        </Fragment>
                    ))}
                </p>
            </div>
        </div>
    );
}
