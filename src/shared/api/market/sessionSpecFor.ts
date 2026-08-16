import {
    US_EQUITY_SESSION,
    CRYPTO_SESSION,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import type { SessionModel } from '@/shared/config/marketProfile/types';

const KR_MARKET_OPEN_MINUTE = 9 * 60; // 09:00 KST
const KR_MARKET_CLOSE_MINUTE = 15 * 60 + 30; // 15:30 KST

/**
 * KRX 정규장 세션 — 09:00~15:30 KST, 주말 휴장.
 *
 * core에 상수를 추가하지 않고 siglens에 두는 이유: `MarketSessionSpec`은 순수
 * 데이터 유니온(`kind`/`timeZone`/`openMinute`/`closeMinute`/`weekendDays`)이고,
 * 이 값은 계산식이 아니라 시장 메타데이터다. `SCOPE.md §0`이 core로 보내는 트리거
 * (지표 계산식·신호 임계값·프롬프트·캐시 정책)에 해당하지 않는다.
 *
 * `getCachedMarketDataProvider`가 `US_EQUITY_SESSION`/`CRYPTO_SESSION`과 마찬가지로
 * **참조 동일성**으로 이 값을 분기하므로 반드시 모듈 레벨 상수여야 한다 — 호출마다
 * 새 객체를 만들면 provider 싱글톤 분기가 조용히 깨진다.
 *
 * 한국 공휴일(설·추석 등)은 표현하지 않는다. 휴장일에는 yahoo가 봉을 반환하지 않아
 * 차트는 정상이고, 영향은 캐시 TTL이 장중으로 오판되어 짧아지는 것뿐이다(비용 소폭
 * 증가, 데이터 오답 없음). KST는 DST가 없어 오프셋 계산도 불필요하다.
 */
export const KR_EQUITY_SESSION: MarketSessionSpec = {
    kind: 'scheduled',
    timeZone: 'Asia/Seoul',
    openMinute: KR_MARKET_OPEN_MINUTE,
    closeMinute: KR_MARKET_CLOSE_MINUTE,
    weekendDays: [0, 6],
};

/**
 * Map a market profile to the core MarketSessionSpec.
 *
 * The mapping is explicit and exhaustive over `SessionModel` values so that
 * adding a new session model (e.g. 'kr-equity-et') forces a compile-time
 * decision here rather than silently falling through to US_EQUITY_SESSION.
 * The previous `=== 'always-open' ? CRYPTO : US_EQUITY` ternary would
 * mis-classify any future non-equity, non-crypto profile (e.g. 'kr-equity')
 * as US equity without a type error.
 */
export function sessionSpecFor(profile: MarketProfileId): MarketSessionSpec {
    const sessionModel: SessionModel = getDescriptor(profile).sessionModel;
    switch (sessionModel) {
        case 'always-open':
            return CRYPTO_SESSION;
        case 'us-equity-et':
            return US_EQUITY_SESSION;
        case 'kr-equity-kst':
            return KR_EQUITY_SESSION;
        default: {
            // Exhaustiveness guard: TypeScript narrows `sessionModel` to `never`
            // here if all SessionModel variants are handled above. If a new
            // variant is added to SessionModel without updating this switch,
            // the assignment below produces a compile error.
            const _exhaustive: never = sessionModel;
            console.error(
                `[sessionSpecFor] Unhandled SessionModel: ${String(_exhaustive)} — defaulting to US_EQUITY_SESSION`
            );
            return US_EQUITY_SESSION;
        }
    }
}
