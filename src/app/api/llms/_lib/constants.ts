/**
 * llms.txt 공개 캐시. 본문은 배포와 게이트(벤치마크, 공개 API)로만 바뀐다. 게이트가 배포 없이 바뀌어도
 * 1시간 안에 반영된다.
 */
export const LLMS_TXT_CACHE_CONTROL =
    'public, max-age=3600, stale-while-revalidate=3600';
export const LLMS_TXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
