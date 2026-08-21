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

// Matches /<SEGMENT> or /<SEGMENT>/(fundamental|news|overall|fear-greed).
// The first path segment must be 1–8 characters (letters and/or dots).
// Case-insensitive so both /AAPL and /aapl resolve correctly.
const SYMBOL_PATH_RE =
    /^\/([A-Z.]{1,8})(\/(fundamental|news|overall|fear-greed))?$/i;

type SymbolSubpage = 'fundamental' | 'news' | 'overall' | 'fear-greed';

/**
 * 표시 문자열이 아니라 `entities.chat-message.pageContext` **키**다.
 * 이 모듈은 훅을 쓸 수 없는 순수 함수라, 여기서 한국어를 고정하면 챗 헤더의
 * 페이지 컨텍스트 배지가 `/en`에서도 `차트 분석`으로 나온다.
 */
const SUBPAGE_LABEL_KEY: Record<SymbolSubpage, string> = {
    fundamental: 'fundamental',
    news: 'news',
    overall: 'overall',
    'fear-greed': 'fear-greed',
};

const BASE_SYMBOL_LABEL_KEY = 'chart';

function isSymbolSubpage(value: string | undefined): value is SymbolSubpage {
    return (
        value === 'fundamental' ||
        value === 'news' ||
        value === 'overall' ||
        value === 'fear-greed'
    );
}

/** Page-context message **key** from pathname; `null` on non-symbol pages (e.g. `/account`). */
export function deriveLabelKey(pathname: string): string | null {
    const match = SYMBOL_PATH_RE.exec(pathname);
    if (!match) return null;

    // Exclude known static routes (e.g. /account, /login) that happen to
    // have 1–8 character first segments.
    const segment = match[1]!.toLowerCase();
    if (STATIC_ROUTES.has(segment)) return null;

    // Lowercase the captured sub-page so case-insensitive matches resolve correctly.
    const subpage = match[3]?.toLowerCase();
    return isSymbolSubpage(subpage)
        ? SUBPAGE_LABEL_KEY[subpage]
        : BASE_SYMBOL_LABEL_KEY;
}
