import { classifyEntrySource } from '@/entities/visitor/lib/classifyEntrySource';
import type { EntrySource } from '@/entities/visitor/types';
import { SITE_HOST } from '@/shared/lib/seo';

/**
 * 비콘 본문 상한(바이트). 정상 본문은 100바이트 안팎(`{ referrerHost, utmSource }`)이다 — 넘으면
 * 읽지 않고 출처 없음으로 둔다. 공개 엔드포인트라 큰 본문을 통째로 버퍼링·파싱하지 않는다.
 */
const MAX_BODY_BYTES = 1024;

/** 필드 하나의 문자열 상한(DNS 이름 최대 253자). */
const MAX_FIELD_LENGTH = 253;

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
    if (text === '' || text.length > MAX_BODY_BYTES) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * 방문 비콘 본문(`{ referrerHost, utmSource }`)을 출처 분류로 바꾼다. 원본 값은 분류 뒤 버린다.
 *
 * 본문이 없거나, 크거나, 모양이 달라도 `null`을 돌려 방문은 출처 없이 기록한다 — 옛 클라이언트(본문
 * 없는 비콘)가 그대로 기록돼야 하고, 이 라우트는 결과를 읽지 않는 비콘이라 언제나 204로 답한다
 * (`route.ts`). 그래서 SERVER.md#SA-9의 400 응답 규칙 대신 "잘못된 입력은 출처 없음"으로 흡수한다.
 */
export async function entrySourceOf(
    request: Request | undefined
): Promise<EntrySource | null> {
    if (request === undefined) return null;
    const body = await readSmallJson(request);
    if (typeof body !== 'object' || body === null) return null;
    const { referrerHost, utmSource } = body as Record<string, unknown>;
    return classifyEntrySource({
        referrerHost: boundedString(referrerHost),
        utmSource: boundedString(utmSource),
        ownHost: SITE_HOST,
    });
}
