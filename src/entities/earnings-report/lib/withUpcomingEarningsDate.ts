/**
 * 실적일 목록(오름차순)을 오늘 이전 날짜 + 대조된 다음 실적일로 맞춘다. DB에 남은 예정일은 FMP 투영일이라, 회사가
 * 다른 날짜를 확정했으면 눌림 해석 창이 옛 날짜를 보지 않게 바꾼다. 다음 실적이 없으면 목록 그대로다.
 */
export function withUpcomingEarningsDate(
    dates: readonly string[],
    upcoming: string | null,
    today: string
): readonly string[] {
    if (upcoming === null) return dates;
    const past = dates.filter(date => date < today && date !== upcoming);
    return [...past, upcoming].toSorted();
}
