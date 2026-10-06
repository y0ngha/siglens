import 'server-only';
import {
    reserveAnalysisGeneration,
    type AnalysisQuotaIdentity,
} from '@/entities/analysis/server/analysisGenerationQuota';
import { getClientIp } from '@/shared/api/getClientIp';
import { mintGuestIdOnResponse, readGuestId } from '@/shared/api/guestId';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { isAiProviderFailure } from '@/shared/lib/aiProviderFailure';
import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';
import {
    RateLimitedStreamError,
    type AnalysisRateLimitAudience,
    type AnalysisRateLimitReason,
} from '@/shared/lib/sse/analysisRateLimit';

/**
 * 이 라우트 요청 하나가 새 생성에 대해 받은 판정.
 *
 * - `allowed`: 예약됨. 생성이 일어나지 않았으면 `refund`로 되돌린다.
 * - `rate_limited`: 한도 초과(또는 비회원 저장소 장애). 캐시 전용으로 강등하고,
 *   캐시도 없으면 `rate_limited` SSE 이벤트로 끝낸다.
 * - `exempt`: 클라이언트가 이미 캐시 전용을 요청했다 — 생성이 불가능하니 셀 것이 없다.
 */
export type GenerationGate =
    | {
          readonly kind: 'allowed';
          readonly refund: () => Promise<void>;
      }
    | {
          readonly kind: 'rate_limited';
          readonly audience: AnalysisRateLimitAudience;
          readonly reason: AnalysisRateLimitReason;
          readonly retryAt: number;
      }
    | { readonly kind: 'exempt' };

const EXEMPT: GenerationGate = { kind: 'exempt' };

/** 신원 해석 자체가 실패했을 때 비회원에게 알려 줄 재시도 간격. */
const IDENTITY_FAILURE_RETRY_MS = 5 * MS_PER_MINUTE;

/**
 * 한도 주체를 정한다. 회원은 userId, 비회원은 이 요청이 들고 온 서명된 게스트
 * 쿠키 + IP. IP는 `cf-connecting-ip`(Cloudflare가 매 요청 덮어씀)를 먼저 본다 —
 * 오리진은 CF 터널로만 들어오므로 신뢰할 수 있다(`getClientIp` JSDoc).
 *
 * 쿠키가 없으면 이 응답에 새로 발급하고(`mintGuestIdOnResponse`), **이번 요청은**
 * 쿠키 없는 신원(`guestId: null` → IP 축만)으로 센다. 발급한 id를 바로 쓰면 쿠키를
 * 버리는 스크립트가 요청마다 새 개인 한도를 얻는다.
 */
async function resolveQuotaIdentity(
    userId: string | null
): Promise<AnalysisQuotaIdentity> {
    if (userId !== null) return { kind: 'member', userId };
    const [guestId, clientIp] = await Promise.all([
        readGuestId(),
        getClientIp(),
    ]);
    if (guestId === null) await mintGuestIdOnResponse();
    return { kind: 'guest', guestId, clientIp };
}

/**
 * 생성 가능성이 있는 요청이면 예약하고, 클라이언트가 캐시 전용을 요청했으면 건너뛴다.
 *
 * **던지지 않는다.** 신원 해석(`cookies()`/`headers()`)이 실패하면 장애와 같게
 * 다룬다 — 비회원은 캐시 전용(fail-closed), 회원은 통과(fail-open, 저장소 정책과 같다).
 * 예약 자체의 장애·지연 처리는 `reserveAnalysisGeneration`이 맡는다.
 */
export async function reserveGenerationGate(
    userId: string | null,
    clientCacheOnly: boolean
): Promise<GenerationGate> {
    if (clientCacheOnly) return EXEMPT;
    try {
        const reservation = await reserveAnalysisGeneration(
            await resolveQuotaIdentity(userId)
        );
        return reservation.ok
            ? { kind: 'allowed', refund: reservation.refund }
            : {
                  kind: 'rate_limited',
                  audience: reservation.audience,
                  reason: reservation.reason,
                  retryAt: reservation.retryAt,
              };
    } catch (error) {
        console.error('[analysis-quota] identity resolution failed', error);
        return userId !== null
            ? { kind: 'allowed', refund: async () => {} }
            : {
                  kind: 'rate_limited',
                  audience: 'guest',
                  reason: 'unavailable',
                  retryAt: Date.now() + IDENTITY_FAILURE_RETRY_MS,
              };
    }
}

/**
 * 생성이 일어나지 않은 경로(쿨다운 거절·동시성 503·예기치 못한 예외)에서 예약을
 * 되돌린다. 멱등이다 — 예약의 `refund`가 한 번만 실행되므로 정산 경로와 겹쳐도
 * 두 번 빼지 않는다.
 */
export async function releaseGenerationGate(
    gate: GenerationGate
): Promise<void> {
    if (gate.kind === 'allowed') await gate.refund();
}

/**
 * 이 요청이 LLM 생성을 실제로 일으켰는지 판정하는 방법.
 *
 * technical·overall은 core `onPromptAssembled`(캐시 미스 승자에게만, 프로바이더 호출
 * 직전 정확히 한 번)가 있어 정확하다. 나머지 축은 그 콜백이 없어 결과 상태로
 * 근사한다 — `done`만 생성으로 친다(동시 요청 패자도 `done`을 받으므로 약간 과대
 * 계산된다).
 *
 * 그 축들의 거절(throw)은 원인으로 가른다. 프로바이더 장애(`isAiProviderFailure`)와
 * 마감 초과(`withDeadline`의 `LocalizedStreamError` — 10분이 지났다면 호출은 이미
 * 나갔다)는 생성으로 치고, 나머지(데이터 조회 실패 등 프로바이더 호출 전 예외)는
 * 환불한다. 액션 대부분은 실패를 `{ status: 'error' }`로 돌려주므로 throw 자체가 드물다.
 *
 * 감지할 수 없는 경우: 클라이언트 이탈은 core로 전파되지 않으므로(라우트의
 * `withDeadline` 주석) "스트림 시작 전 abort"라는 경로가 이 라우트에는 없다 — 이탈해도
 * 작업은 끝까지 돌고 위 규칙대로 정산된다.
 */
export interface GenerationProbe<T> {
    readonly onResolved: (result: T) => boolean;
    readonly onRejected: (error: unknown) => boolean;
}

function statusOf(value: unknown): unknown {
    return typeof value === 'object' && value !== null && 'status' in value
        ? value.status
        : undefined;
}

/** `status === 'done'`을 생성으로 치는 근사 판정(콜백이 없는 축). */
export const DONE_STATUS_PROBE: GenerationProbe<unknown> = {
    onResolved: result => statusOf(result) === 'done',
    onRejected: error =>
        isAiProviderFailure(error) || error instanceof LocalizedStreamError,
};

/** 프롬프트 조립 콜백으로 생성 여부를 판정한다(technical·overall). */
export function promptAssembledProbe(
    wasAssembled: () => boolean
): GenerationProbe<unknown> {
    return { onResolved: wasAssembled, onRejected: wasAssembled };
}

/**
 * 프롬프트 조립 여부를 기억하는 추적기. core에 넘길 콜백과 그 결과를 읽는 판정을
 * 한 쌍으로 돌려준다 — 호출부가 플래그 변수를 직접 바꾸지 않게 한다.
 */
export function createPromptAssemblyTracker(): {
    readonly onPromptAssembled: () => void;
    readonly probe: GenerationProbe<unknown>;
} {
    const state = { assembled: false };
    return {
        onPromptAssembled: () => {
            state.assembled = true;
        },
        probe: promptAssembledProbe(() => state.assembled),
    };
}

/**
 * 요청 하나의 예약을 담는 칸. 예약은 try 안에서 하지만 예기치 못한 예외(바깥
 * catch)에서도 되돌려야 해서, 예약 결과를 그 catch까지 들고 가는 용도다. 예약 전에
 * 던졌으면 되돌릴 것이 없다(`exempt`). 되돌리기는 멱등이다(`releaseGenerationGate`).
 */
export interface GenerationGateSlot {
    readonly reserve: (
        userId: string | null,
        clientCacheOnly: boolean
    ) => Promise<GenerationGate>;
    readonly release: () => Promise<void>;
}

export function createGenerationGateSlot(): GenerationGateSlot {
    const slot: { gate: GenerationGate } = { gate: EXEMPT };
    return {
        reserve: async (userId, clientCacheOnly) => {
            slot.gate = await reserveGenerationGate(userId, clientCacheOnly);
            return slot.gate;
        },
        release: () => releaseGenerationGate(slot.gate),
    };
}

/**
 * `work`에 한도 정산을 붙인다.
 *
 * - 허락된 예약: 생성이 없었으면 환불한다(캐시 적중이 무료인 이유).
 *   환불은 기다리지 않는다 — core `refund`는 던지지 않고, 응답을 Redis 왕복만큼
 *   늦출 이유가 없다.
 * - 한도 초과로 캐시 전용 강등된 요청이 `miss_no_trigger`를 받으면 그 결과 대신
 *   {@link RateLimitedStreamError}로 거절해 `rate_limited` 이벤트가 나가게 한다.
 *   캐시 적중이면 결과를 그대로 내준다.
 */
export function settleGenerationGate<T>(
    work: Promise<T>,
    gate: GenerationGate,
    probe: GenerationProbe<T>
): Promise<T> {
    return work.then(
        result => {
            if (gate.kind === 'allowed' && !probe.onResolved(result)) {
                void gate.refund();
            }
            if (
                gate.kind === 'rate_limited' &&
                statusOf(result) === 'miss_no_trigger'
            ) {
                throw new RateLimitedStreamError({
                    audience: gate.audience,
                    reason: gate.reason,
                    retryAt: gate.retryAt,
                });
            }
            return result;
        },
        (error: unknown) => {
            if (gate.kind === 'allowed' && !probe.onRejected(error)) {
                void gate.refund();
            }
            throw error;
        }
    );
}
