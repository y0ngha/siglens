import {
    DEEPSEEK_V4_1_FLASH_MODEL,
    peekOverallAnalysisCache,
} from '@y0ngha/siglens-core';

import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';

/** 종합 분석 캐시 엿보기 결과 — MISS·손상·읽기 실패는 모두 `null`이다. */
export type OverallPeekResult = Awaited<
    ReturnType<typeof peekOverallAnalysisCache>
> | null;

/**
 * 종합 탭 SSR이 쓰는 종합 분석 캐시 엿보기(읽기 전용 — enqueue·생성 없음).
 *
 * 키를 익명·SSR 기본 방문자가 캐시를 쓰는 키와 맞춘다. 그래야 HIT한다:
 * - 모델은 `SymbolModelContext` 기본값과 같은 DeepSeek flash다(클라가 그 값을 그대로 보낸다).
 * - reasoning은 `false` 고정이다. 이 엿보기는 익명·봇 셸이라 writer(익명·free)의 reasoning-OFF 키와
 *   맞아야 하고, 회원이 토글을 켠 결과가 셸에 섞이지 않는다(회원은 클라 재요청으로 자기 값을 받는다).
 * - 타임프레임은 기본값이다. `?tf=`는 클라가 URL에서 읽으므로 서버 HTML은 하나다.
 * - 회사명은 심볼과 1:1이라 캐시 키에서 뺀다 — 이름이 바뀌어도 심볼 태그 무효화로 갱신된다.
 *
 * 실패는 로그 후 `null`로 흡수한다 — 종합 위젯은 idle CTA로 폴백하고 페이지는 깨지지 않는다.
 */
export function loadOverallPeek(
    symbol: string,
    companyName: string,
    locale: Locale
): Promise<OverallPeekResult> {
    return staticSymbolCache(
        ['peek:overall', symbol, DEEPSEEK_V4_1_FLASH_MODEL, locale],
        symbol,
        () =>
            peekOverallAnalysisCache(
                symbol,
                companyName,
                DEFAULT_TIMEFRAME,
                DEEPSEEK_V4_1_FLASH_MODEL,
                false,
                undefined,
                undefined,
                locale
            ),
        [],
        SECONDS_PER_HALF_DAY
    ).catch((error: unknown) => {
        console.error('[OverallPage] peekOverallAnalysisCache failed:', error);
        return null;
    });
}
