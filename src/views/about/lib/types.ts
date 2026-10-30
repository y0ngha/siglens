/**
 * Shapes of the `/about` page's section data. The builders in
 * `aboutSections.ts` resolve every string on the server and the leaf
 * components under `ui/` render these records as they are.
 */
import type { getTranslations } from 'next-intl/server';
import type { ComponentType } from 'react';

/** The `views.about` translator the route's server render resolves. */
export type AboutT = Awaited<ReturnType<typeof getTranslations>>;

/** A stroke icon component that takes only a size/colour class. */
export type IconComponent = ComponentType<{ className?: string }>;

/**
 * The skill counts under the names the `views.about` messages use as ICU
 * arguments (`{indicators}`, `{candles}`, `{patterns}`, `{strategies}`).
 */
export type SkillCountValues = Readonly<
    Record<'indicators' | 'candles' | 'patterns' | 'strategies', number>
>;

/** One "before / with SIGLENS" row of the pain section. */
export interface PainPoint {
    readonly was: string;
    readonly now: string;
}

/** One "what one ticker page covers" tile. */
export interface DataTile {
    readonly Icon: IconComponent;
    readonly title: string;
    readonly body: string;
    readonly scope: string;
    /** A real ticker tab that shows this data, so the tile is also a way in. */
    readonly href: string;
    /** The tile's link text, e.g. "삼성전자 재무제표 보기". */
    readonly exampleLabel: string;
}

/** One numbered step of "how an analysis is made". */
export interface MethodStep {
    readonly title: string;
    readonly body: string;
}

/** A labelled link; `href` is a site path unless the type says otherwise. */
export interface LabelledLink {
    readonly href: string;
    readonly label: string;
}

/** One of the operator card's contact/source links (absolute URLs). */
export interface OperatorLink extends LabelledLink {
    readonly rel?: string;
    /** Draws the GitHub mark before the label. */
    readonly withGithubIcon?: boolean;
}
