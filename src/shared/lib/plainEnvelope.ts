/**
 * SSE 분석 봉투에서 평이화 산문을 꺼낸다.
 *
 * 라우트의 `withReaderViews`가 결과 봉투(`{ status, result, ... }`)에 `plain`을
 * 덧붙인다. 각 탭의 `fetch*` 함수는 `result.result`만 꺼내 쓰므로 이 헬퍼가 없으면
 * 봉투와 함께 버려진다.
 *
 * 롤링 배포 중 구버전 인스턴스는 필드 자체를 안 보내므로 `undefined`도 `null`과 같게
 * 처리한다 — 둘 다 "원본만 보여준다"는 같은 의미다.
 */
export function readPlain(envelope: unknown): string | null {
    if (typeof envelope !== 'object' || envelope === null) return null;
    const value = (envelope as { plain?: unknown }).plain;
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** 분석 결과와 그 평이화 산문을 함께 나르는 값. 각 탭의 쿼리 반환 타입이다. */
export interface WithPlain<T> {
    readonly data: T;
    readonly plain: string | null;
}
