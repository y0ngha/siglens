/**
 * Pure helpers that decide where a disclosure link points and which PTR id a
 * senate row exposes, so the table UI stays free of URL knowledge.
 */
import type { Chamber } from '@y0ngha/siglens-core';

/** Senate efdsearch landing page — the only senate URL reachable without the disclaimer session. */
export const SENATE_EFD_SEARCH_URL = 'https://efdsearch.senate.gov/search/';

/** Number of PTR UUID characters shown as the visible hint (the full id stays available to assistive tech). */
export const PTR_ID_PREFIX_LENGTH = 8;

/**
 * Senate efdsearch deep links return 403/404 outside the disclaimer-accepted
 * session, so senate links always point to the search landing page instead of
 * the original deep link. House PDF links (disclosures-clerk.house.gov) are
 * static and stay direct.
 */
export function getDisclosureHref(chamber: Chamber, link: string): string {
    return chamber === 'senate' ? SENATE_EFD_SEARCH_URL : link;
}

/**
 * Returns null if the URL doesn't match the expected shape (defensive fallback —
 * FMP may change the URL structure).
 *
 * The trailing `$` anchor is intentionally omitted so the regex stays robust
 * to future query strings or fragments appended to the URL.
 */
export function extractSenatePtrId(link: string): string | null {
    return link.match(/\/view\/ptr\/([0-9a-f-]+)/i)?.[1] ?? null;
}
