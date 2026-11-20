import { LOCALES } from '@/shared/i18n/locales';
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
 *
 * 한계: `utm_source`는 링크를 만든 쪽이 정한다. 다른 사이트가 우리 링크에 `utm_source=chatgpt`를
 * 붙이면 그 유입은 chatgpt로 잡힌다 — 집계를 읽을 때 소수의 오염은 감안한다.
 */
const UTM_RULES: ReadonlyMap<string, EntrySource> = new Map<
    string,
    EntrySource
>([
    ['chatgpt.com', 'chatgpt'],
    ['chatgpt', 'chatgpt'],
    ['openai', 'chatgpt'],
    ['perplexity.ai', 'perplexity'],
    ['perplexity', 'perplexity'],
    ['gemini', 'gemini'],
    ['copilot', 'copilot'],
    ['copilot.com', 'copilot'],
    ['claude', 'claude'],
    ['claude.ai', 'claude'],
    ['deepseek', 'deepseek'],
    ['grok', 'grok'],
    ['google', 'google'],
    ['naver', 'naver'],
    ['naver_blog', 'naver-blog'],
    ['naver-blog', 'naver-blog'],
    ['bing', 'bing'],
    ['daum', 'daum'],
    ['x', 'x'],
    ['twitter', 'x'],
    ['threads', 'threads'],
    ['facebook', 'facebook'],
    ['instagram', 'instagram'],
    ['youtube', 'youtube'],
    ['reddit', 'reddit'],
]);

function hostMatches(host: string, domain: string): boolean {
    return host === domain || host.endsWith(`.${domain}`);
}

function classifyHost(host: string): EntrySource {
    for (const [domain, source] of HOST_RULES) {
        if (hostMatches(host, domain)) return source;
    }
    return GOOGLE_HOST.test(host) ? 'google' : 'other';
}

/**
 * 유료 매체로 보는 `utm_medium` 값. 정해진 값만 받고 나머지는 무시한다. 우리 광고는 구글 자동
 * 태그(`gclid` 등)만 쓰지만, 다른 광고 링크가 매체 값을 붙여 와도 광고로 센다.
 */
const PAID_MEDIUMS: ReadonlySet<string> = new Set([
    'cpc',
    'ppc',
    'paid',
    'paid_search',
    'paid_social',
    'display',
    'cpm',
]);

/**
 * 분석 공유 링크 페이지 경로. 로케일 접두사는 선택이고 `id` 뒤 슬래시 하나까지 받는다.
 * 의도적으로 사이트를 보지 않는다(`collapseLandingPath`는 사이트별). ai 호스트에는 `/share` 경로가 없다.
 */
const SHARE_PATH = new RegExp(`^(/(${LOCALES.join('|')}))?/share/[^/]+/?$`);

export interface EntrySourceInput {
    /** 첫 진입 문서의 `document.referrer` 호스트. 없으면 `null`. */
    readonly referrerHost: string | null;
    /** 첫 진입 URL의 `utm_source`. 없으면 `null`. */
    readonly utmSource: string | null;
    /** 첫 진입 URL의 `utm_medium`. 없으면 `null`. */
    readonly utmMedium: string | null;
    /** 첫 진입 URL에 광고 클릭 식별자(`gclid`·`gbraid`·`wbraid`)가 있었는가. 값은 받지 않는다. */
    readonly adClick: boolean;
    /** 비콘이 뜬 페이지의 경로(쿼리 제외). 공유 링크 페이지 판정에 쓴다. */
    readonly landingPath: string | null;
    /** 이 사이트의 호스트(`siglens.io`). 같은 사이트 안의 이동은 출처가 아니다. */
    readonly ownHost: string;
}

function normalize(value: string | null): string | undefined {
    return value?.trim().toLowerCase();
}

/**
 * 하루 첫 진입의 출처를 정해진 분류값으로 바꾼다. 원본 호스트·`utm_*`·클릭 식별자는 여기서 버린다.
 *
 * 우선순위(처음 맞는 것이 이긴다):
 *  1. `paid` — 광고 클릭 식별자가 있거나 `utm_medium`이 유료 매체 값. 클릭 식별자는 광고 네트워크가
 *     클릭 시점에 붙이므로 Referer(`www.google.com`)보다 확실하다.
 *  2. `email` — `utm_source` 또는 `utm_medium`이 `email`. 우리가 메일 링크에 일부러 붙인 값이다.
 *  3. `share` — 공유 링크 페이지는 공유 링크로만 닿고, 메신저는 Referer를 보내지 않는다.
 *  4. 알려진 `utm_source`.
 *  5. 외부 Referer 호스트.
 *  6. 없음(`null`) — 같은 사이트(서브도메인 포함, `ai.siglens.io` → `siglens.io`)에서 온 이동과
 *     Referer가 없는 직접 방문.
 *
 * 1~3은 Referer가 같은 사이트여도 적용된다. 한계: 클릭 식별자가 붙은 주소를 복사해 퍼뜨리면 `paid`로
 * 잡히고, 공유한 사람이 자기 링크를 그날 첫 방문으로 열면 `share`로 잡힌다.
 */
export function classifyEntrySource({
    referrerHost,
    utmSource,
    utmMedium,
    adClick,
    landingPath,
    ownHost,
}: EntrySourceInput): EntrySource | null {
    const utm = normalize(utmSource);
    const medium = normalize(utmMedium);

    if (adClick || (medium !== undefined && PAID_MEDIUMS.has(medium))) {
        return 'paid';
    }
    if (utm === 'email' || medium === 'email') return 'email';
    if (landingPath !== null && SHARE_PATH.test(landingPath)) return 'share';

    const fromUtm = utm === undefined ? undefined : UTM_RULES.get(utm);
    if (fromUtm !== undefined) return fromUtm;

    const host = normalize(referrerHost)?.replace(/\.$/, '');
    if (host === undefined || host === '') return null;
    const own = ownHost.toLowerCase();
    if (hostMatches(host, own)) return null;
    return classifyHost(host);
}
