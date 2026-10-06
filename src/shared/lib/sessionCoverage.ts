/**
 * 세션 키 캐시(`sessionBarsStaticCache`, 종목 탭의 시장 공포·탐욕 판독)가 한 값을 **저장해도
 * 되는가**를 가르는 분류.
 *
 * - `complete` — 마지막 데이터 날짜가 키의 세션 날짜에 도달했다. 저장한다.
 * - `lagging` — 정확히 **직전 거래일**까지만 있다. 대개 일시적이다(provider EOD 발행 지연,
 *   허브 Redis 캐시가 세션 롤 전 값을 들고 있는 1h 창, KRX 휴장일 목록 지평선 밖의 미등록 휴장,
 *   그날 체결이 없던 저유동 종목). 저장하면 한 세션 뒤처진 값이 24h 굳으므로 저장하지 않고,
 *   호출부가 이 렌더의 revalidate를 짧게 낮춰 ISR이 곧 다시 읽게 한다.
 * - `dormant` — 직전 거래일보다도 오래됐다(거래 정지·상장폐지·데이터 공급 중단). 다음 세션
 *   롤까지 바뀔 이유가 없으므로 **저장한다** — 그러지 않으면 그런 종목은 영원히 캐시되지 않고
 *   매 렌더 provider를 다시 부른다.
 * - `empty` — 데이터가 없다. 저장하지 않는다(degrade 처리는 호출부 몫).
 *
 * 날짜는 ISO `YYYY-MM-DD`라 사전순 비교가 곧 날짜 비교다.
 */
export type SessionCoverage = 'complete' | 'lagging' | 'dormant' | 'empty';

export function sessionCoverage(
    lastDate: string | null,
    sessionDate: string,
    previousSessionDate: string
): SessionCoverage {
    if (lastDate === null) return 'empty';
    if (lastDate >= sessionDate) return 'complete';
    if (lastDate >= previousSessionDate) return 'lagging';
    return 'dormant';
}

/** 저장해도 되는 분류인가. */
export function isStorableCoverage(coverage: SessionCoverage): boolean {
    return coverage === 'complete' || coverage === 'dormant';
}
