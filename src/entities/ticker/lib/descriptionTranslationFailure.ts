import 'server-only';
import { getUpstashWriterCredentials } from '@/shared/cache/redisClient';
import { runUpstashCommandOutsideFetch } from '@/shared/cache/upstashRenderSafeCommand';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * 회사 설명 한국어 번역(`translateCompanyDescription`)이 실패했거나 빈 글을 돌려준 심볼의
 * 표시 — 음성 캐시.
 *
 * ## 왜 필요한가
 *
 * 번역 결과는 성공했을 때만 DB(`profile_description_translations`)에 남는다. 실패는 아무것도
 * 남기지 않아, 같은 심볼의 다음 SSR(ISR 재생성·데이터 캐시 만료·인스턴스마다 따로 도는 콜드
 * 렌더)이 매번 같은 번역을 다시 불렀다(2026-10 비용 감사 L5). 모델이 같은 설명에 같은 식으로
 * 실패하면(빈 출력 등) 그 비용은 영영 돌려받지 못한다.
 *
 * ## TTL을 하루로 두는 이유
 *
 * 설명 섹션의 데이터 캐시와 페이지 revalidate가 하루다(`fundamental/page.tsx`). 표시가 그보다
 * 짧으면 다음 재생성 때 이미 사라져 막는 것이 없고, 길면 프로바이더 일시 장애로 생긴 표시가
 * 회복 뒤에도 남아 영어 원문이 그만큼 더 나간다. 하루면 실패한 심볼은 인스턴스 수와 무관하게
 * 하루 한 번만 다시 시도된다.
 *
 * ## 읽기·쓰기 모두 전역 `fetch`를 거치지 않는다
 *
 * 호출부가 정적(ISR) 렌더 안이다. `@upstash/redis`의 no-store fetch를 쓰면 재생성이 동적으로
 * 판정돼 실패한다 — `ssrMissMarker.ts`와 같은 이유로 `runUpstashCommandOutsideFetch`를 쓴다.
 *
 * Redis 미설정·장애면 "표시 없음"/noop — 최악이 이 모듈 전의 동작(매번 재시도)이다.
 */
const DESCRIPTION_TRANSLATION_FAILURE_TTL_SECONDS = SECONDS_PER_DAY;

const keyOf = (symbol: string): string =>
    `ticker:description-ko-failed:${symbol.toUpperCase()}`;

/** 최근에 이 심볼의 설명 번역이 실패했는지. Redis 미설정·장애는 false. */
export async function hasDescriptionTranslationFailed(
    symbol: string
): Promise<boolean> {
    if (getUpstashWriterCredentials() === null) return false;
    try {
        return (
            (await runUpstashCommandOutsideFetch(['GET', keyOf(symbol)])) !==
            null
        );
    } catch (error) {
        console.error('[descriptionTranslationFailure] get failed', error);
        return false;
    }
}

/** 이 심볼의 설명 번역이 실패했다고 표시한다. 실패는 삼킨다. */
export async function markDescriptionTranslationFailed(
    symbol: string
): Promise<void> {
    if (getUpstashWriterCredentials() === null) return;
    try {
        await runUpstashCommandOutsideFetch([
            'SET',
            keyOf(symbol),
            '1',
            'EX',
            DESCRIPTION_TRANSLATION_FAILURE_TTL_SECONDS,
        ]);
    } catch (error) {
        console.error('[descriptionTranslationFailure] set failed', error);
    }
}
