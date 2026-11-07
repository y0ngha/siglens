import type { EntrySource } from '../types';

/**
 * 호스트 → 분류. `hostMatches`가 서브도메인까지 맞추고, 첫 일치가 이긴다.
 *
 * 포털은 **검색 호스트만** 검색엔진으로 센다 — `finance.naver.com`·`news.naver.com`·
 * `finance.daum.net` 같은 증권·뉴스 서비스는 검색이 아니라 추천 유입이라 `naver-finance`나
 * `other`로 간다. 안드로이드 앱의 Referer(`android-app://<패키지>/`)는 패키지 이름이 호스트로
 * 잡히므로 구글 앱(디스커버 포함)·네이버 앱 패키지를 따로 적는다.
 */
const HOST_RULES: ReadonlyArray<readonly [string, EntrySource]> = [
    ['chatgpt.com', 'chatgpt'],
    ['chat.openai.com', 'chatgpt'],
    ['perplexity.ai', 'perplexity'],
    ['perplexity.com', 'perplexity'],
    ['gemini.google.com', 'gemini'],
    ['bard.google.com', 'gemini'],
    ['copilot.microsoft.com', 'copilot'],
    ['claude.ai', 'claude'],
    ['chat.deepseek.com', 'deepseek'],
    ['grok.com', 'grok'],
    ['blog.naver.com', 'naver-blog'],
    ['cafe.naver.com', 'naver-blog'],
    ['finance.naver.com', 'naver-finance'],
    ['stock.naver.com', 'naver-finance'],
    ['search.naver.com', 'naver'],
    ['www.naver.com', 'naver'],
    ['m.naver.com', 'naver'],
    ['com.nhn.android.search', 'naver'],
    ['com.google.android.googlequicksearchbox', 'google'],
    ['bing.com', 'bing'],
    ['search.daum.net', 'daum'],
    ['www.daum.net', 'daum'],
    ['m.daum.net', 'daum'],
    ['duckduckgo.com', 'duckduckgo'],
    ['x.com', 'x'],
    ['twitter.com', 'x'],
    ['t.co', 'x'],
    ['threads.net', 'threads'],
    ['threads.com', 'threads'],
    ['facebook.com', 'facebook'],
    ['instagram.com', 'instagram'],
    ['youtube.com', 'youtube'],
    ['reddit.com', 'reddit'],
];

/**
 * 검색 호스트 `google.com`, `www.google.co.kr`, `www.google.com.au` … — 국가 도메인이 많아 규칙
 * 표 대신 패턴으로 본다. `www.`만 허용해 `news.google.com`·`mail.google.com`은 받지 않고, 끝을
 * Google의 국가 도메인 형태로 고정해 `google.com.evil.example`도 받지 않는다.
 */
const GOOGLE_HOST =
    /^(www\.)?google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/;

/**
 * `utm_source` → 분류. ChatGPT 검색은 링크에 `utm_source=chatgpt.com`을 붙이고, 앱 내 브라우저는
 * Referer를 비우기도 해서 Referer보다 이 값이 더 믿을 만하다. 정해진 값만 받고 나머지는 무시한다
 * (자유 입력 문자열을 분류값으로 저장하지 않는다).
 */
const UTM_RULES: Readonly<Record<string, EntrySource>> = {
    'chatgpt.com': 'chatgpt',
    chatgpt: 'chatgpt',
    openai: 'chatgpt',
    'perplexity.ai': 'perplexity',
    perplexity: 'perplexity',
    gemini: 'gemini',
    copilot: 'copilot',
    'copilot.com': 'copilot',
    claude: 'claude',
    'claude.ai': 'claude',
    deepseek: 'deepseek',
    grok: 'grok',
    google: 'google',
    naver: 'naver',
    naver_blog: 'naver-blog',
    'naver-blog': 'naver-blog',
    bing: 'bing',
    daum: 'daum',
    x: 'x',
    twitter: 'x',
    threads: 'threads',
    facebook: 'facebook',
    instagram: 'instagram',
    youtube: 'youtube',
    reddit: 'reddit',
};

function hostMatches(host: string, domain: string): boolean {
    return host === domain || host.endsWith(`.${domain}`);
}

function classifyHost(host: string): EntrySource {
    for (const [domain, source] of HOST_RULES) {
        if (hostMatches(host, domain)) return source;
    }
    return GOOGLE_HOST.test(host) ? 'google' : 'other';
}

export interface EntrySourceInput {
    /** 첫 진입 문서의 `document.referrer` 호스트. 없으면 `null`. */
    readonly referrerHost: string | null;
    /** 첫 진입 URL의 `utm_source`. 없으면 `null`. */
    readonly utmSource: string | null;
    /** 이 사이트의 호스트(`siglens.io`). 같은 사이트 안의 이동은 출처가 아니다. */
    readonly ownHost: string;
}

/**
 * 하루 첫 진입의 출처를 정해진 분류값으로 바꾼다. 원본 호스트·`utm_source`는 여기서 버린다.
 *
 * 순서: 알려진 `utm_source` → 외부 Referer 호스트 → 없음(`null`). 같은 사이트(서브도메인 포함,
 * `ai.siglens.io` → `siglens.io`)에서 온 이동과 Referer가 없는 직접 방문은 `null`이다.
 */
export function classifyEntrySource({
    referrerHost,
    utmSource,
    ownHost,
}: EntrySourceInput): EntrySource | null {
    const utm = utmSource?.trim().toLowerCase();
    if (utm !== undefined && Object.hasOwn(UTM_RULES, utm)) {
        return UTM_RULES[utm];
    }

    const host = referrerHost?.trim().toLowerCase().replace(/\.$/, '');
    if (host === undefined || host === '') return null;
    const own = ownHost.toLowerCase();
    if (hostMatches(host, own)) return null;
    return classifyHost(host);
}
