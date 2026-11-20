import { classifyEntrySource } from '@/entities/visitor/lib/classifyEntrySource';
import type { EntrySource } from '@/entities/visitor/types';
import type { PresenceBody } from '@/app/api/presence/_shared/readPresenceBody';
import { SITE_HOST } from '@/shared/lib/seo';

/**
 * 비콘 본문과 Referer 경로를 출처 분류로 바꾼다. 원본 값은 분류 뒤 버린다.
 *
 * 본문이 없거나 모양이 달라도 본문 입력 없이(`null`·`false`) 분류한다 — 옛 클라이언트가 그대로
 * 기록돼야 하고, 이 라우트는 결과를 읽지 않는 비콘이라 언제나 204로 답한다(`route.ts`). 그래서
 * SERVER.md#SA-9의 400 응답 규칙 대신 "잘못된 입력은 출처 없음"으로 흡수한다.
 * `landingPath`는 본문이 아니라 Referer에서 온 값이라 본문이 없어도 공유 링크 판정은 선다.
 */
export function entrySourceOf(
    body: PresenceBody | null,
    landingPath: string | null
): EntrySource | null {
    return classifyEntrySource({
        referrerHost: body?.referrerHost ?? null,
        utmSource: body?.utmSource ?? null,
        utmMedium: body?.utmMedium ?? null,
        adClick: body?.adClick ?? false,
        landingPath,
        ownHost: SITE_HOST,
    });
}
