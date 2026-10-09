import 'server-only';
import {
    buildRevealedTierConfig,
    getMeteredRevealPolicy,
    type Tier,
    type TierConfig,
} from '@y0ngha/siglens-core';
import {
    decideMeteredReveal,
    METERED_REVEAL_STARTS_AT,
} from '@/entities/analysis/server/meteredReveal';
import type { AnalysisMeter } from '@/shared/lib/types';
import type { GuestResolver } from './generationQuota';

/**
 * 이 요청이 비회원 하루 무료 공개 미터를 어떻게 탔는지.
 *
 * - `off`: 미터가 적용되지 않는다(회원·정책 없음·크롤러·시행 전·저장소 장애). 현행 free
 *   마스킹 그대로이며 응답에 `meter` 필드를 싣지 않는다.
 * - `revealed`: 오늘의 공개 종목이다. `tierConfig`를 `runAnalysis`에 넘겨 마스킹만
 *   member 깊이로 바꾼다(캐시 키는 tier 그대로라 새 생성이 늘지 않는다).
 *   `release`는 결과 없이 끝났을 때 신규 기록을 되돌린다(멱등).
 * - `exhausted`: 오늘 몫을 이미 썼다. 마스킹은 현행 그대로, 응답에 `meter`만 싣는다.
 */
export type MeterGate =
    | { readonly kind: 'off' }
    | {
          readonly kind: 'revealed';
          readonly tierConfig: TierConfig;
          readonly release: () => Promise<void>;
      }
    | { readonly kind: 'exhausted' };

const OFF: MeterGate = { kind: 'off' };

export interface ResolveMeterGateInput {
    readonly userId: string | null;
    readonly tier: Tier;
    readonly symbol: string;
    readonly guest: GuestResolver;
    readonly now: Date;
}

/**
 * 하루 무료 공개 미터를 판정한다. **던지지 않는다** — 어떤 실패도 `off`(현행 잠금)다.
 *
 * 크롤러는 건너뛴다: 크롤러에게 공개 내용을 주면 SEO 스냅샷과 어긋나고, 검증된
 * 크롤러가 사람의 몫을 소모하지도 않아야 한다. `cacheOnly` 요청에도 적용한다 —
 * 비회원 롱테일 종목은 캐시 적중 결과도 공개 대상이다.
 */
export async function resolveMeterGate(
    input: ResolveMeterGateInput
): Promise<MeterGate> {
    const { userId, tier, symbol, guest, now } = input;
    if (userId !== null || tier !== 'free') return OFF;
    if (now < METERED_REVEAL_STARTS_AT) return OFF;
    const policy = getMeteredRevealPolicy('free');
    if (policy === null) return OFF;

    try {
        if (await guest.isCrawler()) return OFF;
        const { meterGuestId, clientIp } = await guest.context();
        const decision = await decideMeteredReveal({
            guestId: meterGuestId,
            clientIp,
            symbol,
            policy,
            now,
        });
        if (decision.state === 'unavailable') return OFF;
        if (decision.state === 'exhausted') return { kind: 'exhausted' };
        return {
            kind: 'revealed',
            tierConfig: buildRevealedTierConfig('free'),
            release: decision.release,
        };
    } catch (error) {
        console.warn('[meter] gate failed, falling back to locked', error);
        return OFF;
    }
}

/** 응답에 실을 `meter` 필드. `off`면 필드를 싣지 않는다. */
export function meterPayload(
    gate: MeterGate
): { readonly meter: AnalysisMeter } | Record<never, never> {
    return gate.kind === 'off' ? {} : { meter: { state: gate.kind } };
}
