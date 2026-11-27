/**
 * Pure helpers that turn a cached SEO snapshot row into the excerpt card shown
 * on `/lp/stock-analysis`. Display-only selection of already generated text; no
 * analysis logic lives here.
 */
import type { Trend } from '@y0ngha/siglens-core';
import { narrowTechnicalContent } from '@/entities/seo-snapshot/lib/technicalContent';
import { readSnapshotBasis } from '@/entities/seo-snapshot/lib/snapshotBasis';
import type { SeoAnalysisSnapshot } from '@/entities/seo-snapshot/model';
import {
    formatSnapshotAsOf,
    resolveSnapshotAsOf,
} from '@/shared/lib/formatSnapshotAsOf';
import { SITE_URL } from '@/shared/lib/seo';
import { clampAtSentenceBoundary } from '@/shared/lib/seoSnapshotDescription';
import { lpCopyViolations } from './lpCopyRules';
import type { LpAnalysisSubject, LpRealAnalysis } from './types';

/** Excerpt budget in code points: the lead paragraph plus the second only when both fit. */
export const LP_EXCERPT_MAX_CHARS = 420;

/** Same values as `shared.enumLabel.trend.*` in `messages/ko.json` (a test pins them). */
export const LP_TREND_LABEL: Record<Trend, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '보합',
};

const AS_OF_SUFFIX: Record<LpAnalysisSubject['marketProfile'], string> = {
    'us-equity': '미국 장 마감 기준',
    'kr-equity': '국내 장 마감 기준',
};

/** Splits plain prose into paragraphs the way `PlainAnalysisView` does. */
export function splitPlainParagraphs(plain: string): string[] {
    return plain
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

/**
 * The lead paragraph (clamped at a sentence end) plus the second paragraph only
 * if the total stays within {@link LP_EXCERPT_MAX_CHARS}. Only the first two
 * paragraphs are considered, and any that breaks the ad copy rules is dropped.
 */
export function selectLpExcerpt(paragraphs: readonly string[]): string[] {
    const [lead, second] = paragraphs
        .slice(0, 2)
        .filter(p => lpCopyViolations(p).length === 0);
    if (lead === undefined) return [];
    const clamped = clampAtSentenceBoundary(lead, LP_EXCERPT_MAX_CHARS);
    // A clamped lead has lost its tail, so appending the second paragraph
    // would skip text in the middle: only an intact lead may be followed.
    const leadIntact = clamped === lead;
    if (
        leadIntact &&
        second !== undefined &&
        [...clamped].length + [...second].length <= LP_EXCERPT_MAX_CHARS
    ) {
        return [clamped, second];
    }
    return [clamped];
}

/**
 * Builds one card from a ko technical snapshot row, or `null` when the row
 * cannot back an honest card (no row, corrupt content, no plain prose, every
 * leading paragraph rejected, or no resolvable data date).
 */
export function buildLpRealAnalysis(
    subject: LpAnalysisSubject,
    snapshot: SeoAnalysisSnapshot | undefined
): LpRealAnalysis | null {
    if (snapshot === undefined) return null;
    const content = narrowTechnicalContent(snapshot.content);
    if (content === null) return null;
    if (typeof snapshot.plain !== 'string') return null;

    const paragraphs = selectLpExcerpt(splitPlainParagraphs(snapshot.plain));
    if (paragraphs.length === 0) return null;

    const basis = readSnapshotBasis(snapshot.content);
    const resolved = resolveSnapshotAsOf(
        {
            barTimeMs: basis.barTimeMs,
            analyzedAtMs: basis.analyzedAtMs,
            generatedAtMs: snapshot.generatedAt.getTime(),
        },
        subject.marketProfile
    );
    if (resolved === null) return null;
    const formatted = formatSnapshotAsOf(
        resolved.instant,
        subject.marketProfile,
        'ko'
    );
    if (formatted === null) return null;

    return {
        symbol: subject.symbol,
        name: subject.name,
        href: `${SITE_URL}/${subject.symbol}`,
        trendLabel:
            content.trend === null ? null : LP_TREND_LABEL[content.trend],
        asOfIso: resolved.instant.toISOString(),
        asOfLabel: `${formatted} ${AS_OF_SUFFIX[subject.marketProfile]}`,
        paragraphs,
    };
}
