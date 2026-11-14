// degrade 때문에 `noindex`가 된 렌더의 페이지 엔트리를 **revalidate 창이 지나면 miss로** 본다.
//
// ISR은 stale-while-revalidate다. revalidate가 지난 엔트리는 다음 요청자에게 옛 사본을 그대로
// 주고 뒤에서 다시 만든다. 정상 사본에는 맞는 동작이지만 degrade 사본(입력원 장애로 안내문 +
// `noindex`를 그린 렌더)에는 틀리다 — 롱테일 페이지의 "다음 요청자"는 몇 시간 뒤의 크롤러이고,
// 그 크롤러가 받는 것이 `noindex` 사본이다(2026-11-14 운영 실측: 전날 FMP 429 폭주 때 만들어진
// 펀더멘털 탭 사본 53개가 18시간 뒤 첫 요청까지 캐시에 남아 Googlebot UA에 그대로 나갔다).
// 짧은 revalidate(300초)는 "언제부터 다시 만들 수 있는가"만 정하고 "옛 사본을 한 번 더 내보낸다"는
// 막지 못한다.
//
// 그래서 그런 렌더가 남긴 태그를 보고, 창이 지난 엔트리는 없는 것으로 돌려준다 → Next가
// 그 요청에서 블로킹 렌더한다. 태그는 "옛 사본이 `noindex` 껍데기"인 렌더만 단다 — 본문이 멀쩡한
// 부분 degrade는 대상이 아니라 예전처럼 stale로 나간다(장애 중 즉시 응답 + 재생성 실패 시 안전망).
//
// 입력원이 회복됐으면 요청자는 정상 본문을 받고, 아직이면 새 degrade 사본을 받는다(예전과 같되
// 최소한 "지금 상태"다). 재렌더 횟수는 그대로다 — 예전에도 창이 지난 뒤 첫 요청이 재생성을
// 일으켰고, 달라지는 것은 그 요청이 결과를 기다린다는 점뿐이다.
//
// 태그 문자열은 `src/shared/cache/buildDegradedRevalidate.ts`의 `NOINDEX_DEGRADED_RENDER_TAG`와 같아야
// 한다. 이 파일은 번들 밖 평문 ESM이라 그쪽을 import할 수 없어 값을 따로 두고,
// `__tests__/degradedEntry.test.mjs`가 두 값이 같은지 고정한다.
export const NOINDEX_DEGRADED_RENDER_TAG = 'noindex-degraded-render';

// 엔트리에 revalidate가 영속돼 있지 않을 때(옛 엔트리) 쓰는 창(초).
// `RUNTIME_DEGRADED_REVALIDATE_SECONDS`와 같은 값이다.
const FALLBACK_WINDOW_SECONDS = 300;

/**
 * degrade 태그가 붙은 페이지 엔트리가 자기 revalidate 창을 넘겼는가.
 *
 * `cacheControl.revalidate`가 숫자가 아니면(`false` = 무기한, 또는 미상) 기본 창을 쓴다 —
 * 이 태그를 단 렌더는 항상 300초 핀을 거치므로 무기한일 수 없고, 값이 없다면 영속 전의 옛 엔트리다.
 */
export function isExpiredDegradedEntry(entry, now) {
    const tags = entry?.tags;
    if (!Array.isArray(tags) || !tags.includes(NOINDEX_DEGRADED_RENDER_TAG)) {
        return false;
    }
    const revalidate = entry.cacheControl?.revalidate;
    const windowSeconds =
        typeof revalidate === 'number' && revalidate > 0
            ? revalidate
            : FALLBACK_WINDOW_SECONDS;
    return now - entry.lastModified > windowSeconds * 1000;
}
