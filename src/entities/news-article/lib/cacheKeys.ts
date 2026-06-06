/**
 * news list per-symbol cache 키 prefix. /news와 /overall page가 같은 SSR snapshot을
 * 공유하려면 staticSymbolCache 키 리터럴이 일치해야 한다(키 hash가 분리되면 cold path
 * 중복 fetch 발생).
 */
export const NEWS_LIST_CACHE_KEY = 'news:list' as const;
