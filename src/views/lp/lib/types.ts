/**
 * Shapes of the hard-coded copy the two ad landing pages render. The data lives
 * in `stockAnalysisContent.ts` and `stockChatContent.ts`; the leaf components
 * under `ui/` take these shapes as props.
 */
import type { ComponentType } from 'react';

/** A stroke icon from `shared/ui/StrokeIcons`. */
export type LpIcon = ComponentType<{ className?: string }>;

/** One `/lp/stock-analysis` feature card. */
export interface Feature {
    readonly Icon: LpIcon;
    readonly title: string;
    /** Which markets the feature covers, shown next to the title. */
    readonly scope: string;
    readonly body: string;
    /** A real symbol tab that shows this data, so the card is also a way in. */
    readonly href: string;
    /** Link text for `href`. */
    readonly example: string;
}

/** A `/lp/stock-analysis` popular-stock chip: company name first, ticker second. */
export interface PopularStock {
    readonly name: string;
    readonly symbol: string;
}

/** One `/lp/stock-chat` "how it answers" step. */
export interface HowStep {
    readonly Icon: LpIcon;
    readonly title: string;
    readonly body: string;
}

/** The worked example in `/lp/stock-chat`'s question-to-answer flow. */
export interface HowDemo {
    readonly question: string;
    readonly answer: string;
    /** Source and as-of chips under the answer. */
    readonly chips: readonly string[];
}

/** One `/lp/stock-chat` FAQ entry. */
export interface FaqEntry {
    readonly q: string;
    readonly a: string;
}
