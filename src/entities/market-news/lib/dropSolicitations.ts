import { isLawFirmSolicitation } from '@/shared/lib/news/isLawFirmSolicitation';

/**
 * 읽기 경로의 로펌 원고 모집 광고 필터.
 *
 * 적재 시점(`FmpMarketNewsClient`)에서도 거르지만, 필터가 생기기 전에 이미 들어간 행이
 * 7일 창 안에 남아 있다. 판정은 **원제목(`titleEn`)** 에만 한다 — 화면에 나가는 제목은
 * 번역본(`titleKo`)일 수 있어 정규식이 맞지 않는다. 정규식은 SQL로 내릴 수 없어 받은 뒤
 * 거른다(7일 창 한 버킷 규모라 부담이 없다). 순서는 보존한다.
 */
export function dropSolicitations<T extends { titleEn: string }>(
    rows: readonly T[]
): T[] {
    return rows.filter(row => !isLawFirmSolicitation(row.titleEn));
}
