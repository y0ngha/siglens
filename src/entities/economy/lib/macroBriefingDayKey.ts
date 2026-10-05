import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * 거시 브리핑 SSR seed의 날짜 버킷 — UTC 달력일(`YYYY-MM-DD`).
 *
 * core의 `buildMacroBriefingDateBucket`(`@internal`, 미export)을 그대로 따른다.
 * core는 2026-10-05부터 거시 브리핑 캐시 키를 시간(`dateHour`)이 아닌 UTC 날짜로
 * 버킷팅하고 TTL을 하루로 늘렸다 — 하루 동안 모델 입력(24h 캐시된 경제 스냅샷)이
 * 똑같아 시간마다 새로 생성하면 같은 입력에 판정만 흔들렸기 때문이다.
 *
 * siglens 쪽 `unstable_cache` 키가 시간 단위로 남아 있으면 같은 브리핑을 하루 24번
 * 다시 읽는 낭비가 되고, 반대로 core와 경계가 다르면 날짜가 바뀌는 순간 siglens
 * 캐시가 한 칸 어긋난다. core 쪽을 바꿀 때는 이 함수도 함께 바꾼다.
 */
export function macroBriefingDayKey(now: Date = new Date()): string {
    return toUtcIsoDate(now);
}
