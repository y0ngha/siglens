// Keep in sync with src/app/ — add entries whenever a new top-level static route is created.
const STATIC_ROUTES = new Set([
    'account',
    'api',
    'backtesting',
    'forgot-password',
    'login',
    'market',
    'privacy',
    'reset-password',
    'signup',
    'terms',
]);

// Matches /<SEGMENT> or /<SEGMENT>/(fundamental|news|overall).
// The first path segment must be 1–8 characters (letters and/or dots).
// Case-insensitive so both /AAPL and /aapl resolve correctly.
const SYMBOL_PATH_RE = /^\/([A-Z.]{1,8})(\/(fundamental|news|overall))?$/i;

const SUBPAGE_LABEL: Record<string, string> = {
    fundamental: '펀더 분석',
    news: '뉴스 분석',
    overall: 'AI 종합 분석',
};

const BASE_SYMBOL_LABEL = '차트 분석';

/** Korean page-context label from pathname; `null` on non-symbol pages (e.g. `/account`). */
export function deriveLabel(pathname: string): string | null {
    const match = SYMBOL_PATH_RE.exec(pathname);
    if (!match) return null;

    // Exclude known static routes (e.g. /account, /login) that happen to
    // have 1–8 character first segments.
    const segment = match[1]!.toLowerCase();
    if (STATIC_ROUTES.has(segment)) return null;

    // Lowercase the captured sub-page so case-insensitive matches resolve correctly.
    const subpage = match[3]?.toLowerCase();
    return SUBPAGE_LABEL[subpage ?? ''] ?? BASE_SYMBOL_LABEL;
}
