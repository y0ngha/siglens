export class FmpHttpError extends Error {
    readonly status: number;
    readonly retryAfterSeconds: number | null;
    readonly symbol: string | null;

    /**
     * `symbol`은 진단용이다. 402는 "이 심볼이 플랜에 포함되지 않음"처럼 심볼 국소
     * 이슈인 경우가 많은데, 메시지에 경로만 있으면 로그를 봐도 **어느 종목이
     * 문제인지 알 수 없어 조치 자체가 불가능**하다(2026-07-26: 야간 pre-warm 창(20:30–03:59 UTC)
     * 전후로 402가 3,014건 찍혔으나 심볼 귀속이 안 돼 매트릭스 제외·플랜 판단 어느
     * 쪽도 불가능했다). 호출부가 심볼을 알 때만 넘기면 되고, 없으면 기존 메시지
     * 형식이 그대로 유지된다.
     */
    constructor(
        path: string,
        status: number,
        retryAfterSeconds: number | null,
        symbol?: string
    ) {
        super(`FMP ${path} ${status}${symbol ? ` (${symbol})` : ''}`);
        this.name = 'FmpHttpError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
        this.symbol = symbol ?? null;
    }
}
