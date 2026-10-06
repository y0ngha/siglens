import { getProfileDescription } from '@/app/[locale]/[symbol]/fundamental/fundamentalData';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import type { Locale } from '@/shared/i18n/locales';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';

/**
 * AI 번역 회사 설명을 기다리는 상한. 넘기면 원문(FMP `profile.description`)으로 렌더한다.
 *
 * 프로필 카드는 이제 Suspense 없이 문서 셸과 함께 렌더되므로(서버 데이터 경계는 raw
 * HTML에 숨김 청크를 남긴다), 설명이 늦으면 **페이지 전체**가 그만큼 늦는다. ko 첫 방문은
 * 번역 LLM 호출이 끝날 때까지 걸릴 수 있어 상한을 둔다. 번역 자체는 계속 진행돼 DB에
 * 저장되므로(`getProfileDescription`) 다음 재생성부터는 번역본이 나간다.
 */
export const PROFILE_DESCRIPTION_TIMEOUT_MS = 4 * MS_PER_SECOND;

/** 실패·시간 초과 표식 — 정상 결과 `null`(번역 행 없음)과 구분한다. */
const DEGRADED = Symbol('profile-description-degraded');

/**
 * 요청 로케일의 회사 설명을 읽되, 실패하거나 `PROFILE_DESCRIPTION_TIMEOUT_MS`를 넘기면
 * `null`을 돌려준다(호출부가 원문으로 폴백한다).
 *
 * ISR degrade guard: 번역이 throw해도 ISR 캐시에 0-byte 결과가 굳지 않도록 흡수한다.
 * 실패·시간 초과로 원문에 떨어진 렌더는 페이지의 `degradeSection`과 같이 revalidate를 짧게
 * 낮춘다(`shortenRevalidateForRuntimeDegrade`) — 그러지 않으면 번역 안 된 원문이 라우트
 * revalidate(24h) 동안 굳는다. 비-ko에서 번역 행이 **없어** `null`인 것은 정상 결과라 낮추지 않는다.
 * 타이머는 `unref()` — 레이스에서 진 타이머가 프로세스 종료를 붙잡지 않게 한다.
 */
export async function loadProfileDescription(
    symbol: string,
    locale: Locale
): Promise<string | null> {
    const description = staticSymbolCache(
        // 로케일을 키에 넣지 않으면 먼저 생성된 로케일의 설명이 전 로케일에 굳는다.
        ['fundamental:desc', symbol, ...contentLocaleKeyPart(locale)],
        symbol,
        () => getProfileDescription(symbol, locale),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown): typeof DEGRADED => {
        console.error(
            '[loadProfileDescription] getProfileDescription failed, degrading to original:',
            e
        );
        return DEGRADED;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof DEGRADED>(resolve => {
        timer = setTimeout(() => {
            console.warn(
                `[loadProfileDescription] ${symbol} description exceeded ${PROFILE_DESCRIPTION_TIMEOUT_MS}ms, rendering original`
            );
            resolve(DEGRADED);
        }, PROFILE_DESCRIPTION_TIMEOUT_MS);
        timer.unref();
    });
    try {
        const result = await Promise.race([description, timeout]);
        if (result !== DEGRADED) return result;
        await shortenRevalidateForRuntimeDegrade();
        return null;
    } finally {
        clearTimeout(timer);
    }
}
