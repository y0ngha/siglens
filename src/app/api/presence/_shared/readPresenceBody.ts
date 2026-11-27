import { parseVisitSignals } from '@/entities/visitor/lib/visitHistory';
import type { VisitSignals } from '@/entities/visitor/types';

/**
 * 비콘 본문 상한(바이트). 정상 본문은 200바이트 안팎(출처 신호 네 필드와 `visit` 구간값)이다 — 넘으면
 * 읽지 않고 본문 없음으로 둔다. 공개 엔드포인트라 큰 본문을 통째로 버퍼링·파싱하지 않는다.
 */
const MAX_BODY_BYTES = 1024;

/** 필드 하나의 문자열 상한(DNS 이름 최대 253자). */
const MAX_FIELD_LENGTH = 253;

/**
 * 비콘이 보내는 첫 진입 출처 신호와 방문 이력 구간값. 어느 필드든 모양이 다르면 그 필드만
 * `null`(`adClick`은 `false`)이 된다. 원본은 여기서 분류값으로 바뀌기 전의 입력일 뿐 저장하지 않는다.
 */
export interface PresenceBody {
    readonly referrerHost: string | null;
    readonly utmSource: string | null;
    readonly utmMedium: string | null;
    /** 리터럴 `true`일 때만 `true`. 클릭 식별자의 값은 받지 않는다. */
    readonly adClick: boolean;
    /** 브라우저가 계산한 방문 이력 구간값. 닫힌 목록 검증을 통과한 것만. */
    readonly visit: VisitSignals | null;
}

function boundedString(value: unknown): string | null {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_FIELD_LENGTH
        ? value
        : null;
}

async function readSmallJson(request: Request): Promise<unknown> {
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
    const text = await request.text().catch(() => '');
    // 헤더가 없거나 틀릴 수 있어 실제 바이트 수로 한 번 더 본다.
    if (
        text === '' ||
        new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES
    ) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * 방문 비콘 본문을 읽는다. 본문이 없거나, 크거나, JSON이 아니거나, 객체가 아니면 `null`이다.
 * 옛 클라이언트가 캐시돼 있어도(필드 두 개짜리 본문, 본문 없음) 그대로 받아들인다. 이 라우트는
 * 결과를 읽지 않는 비콘이라 언제나 204로 답하므로(`route.ts`) 잘못된 입력은 400이 아니라 "없음"으로
 * 흡수한다 — SERVER.md#SA-9의 문서화된 예외다.
 */
export async function readPresenceBody(
    request: Request | undefined
): Promise<PresenceBody | null> {
    if (request === undefined) return null;
    const body = await readSmallJson(request);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return null;
    }
    const { referrerHost, utmSource, utmMedium, adClick, visit } =
        body as Record<string, unknown>;
    return {
        referrerHost: boundedString(referrerHost),
        utmSource: boundedString(utmSource),
        utmMedium: boundedString(utmMedium),
        adClick: adClick === true,
        visit: parseVisitSignals(visit),
    };
}
