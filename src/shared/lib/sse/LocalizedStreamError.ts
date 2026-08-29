/**
 * 사용자에게 그대로 보여도 되는, **이미 현지화된** 스트림 오류.
 *
 * ## 왜 텍스트를 스니핑하면 안 되는가
 *
 * 예전에는 `heartbeatStream`이 `/[가-힣]/.test(message)`로 "한글이 있으면 이미
 * 현지화된 것"이라고 판정했다. i18n 이후 이 전제가 **양쪽 방향으로 다 틀렸다**:
 *  - ja/en/zh 사용자에게 갈 한국어 메시지가 그대로 통과한다
 *  - 영문 내부 오류는 하드코딩된 **한국어** 제네릭 문구로 교체된다
 * 즉 어느 분기를 타든 결과가 한국어였다. 실측: `/ja/AAPL`에서 DeepSeek이
 * `Insufficient Balance`를 반환하자 일본어 섹션 사이에
 * `분석 중 오류가 발생했습니다…`가 렌더됐다.
 *
 * 판정은 **문자열의 생김새가 아니라 출처**여야 한다. 카탈로그에서 꺼내 우리가
 * 만든 메시지만 이 타입으로 던지고, 나머지는 전부 내부 오류로 간주해 호출자가
 * 준 로케일별 제네릭 문구로 교체한다(내부 스택·환경변수 노출 방지도 겸한다).
 */
export class LocalizedStreamError extends Error {
    readonly localized = true as const;

    constructor(message: string) {
        super(message);
        this.name = 'LocalizedStreamError';
    }
}

/**
 * core가 재시도를 소진했을 때 쓰는 ASCII sentinel. 클라이언트가 자체 문구로
 * 매핑하므로(`useAnalysis`의 catch) 교체하지 않고 그대로 통과시킨다.
 */
export const AI_SERVER_UNSTABLE = 'AI_SERVER_UNSTABLE';

export function isPassThroughStreamError(error: unknown): boolean {
    if (error instanceof LocalizedStreamError) return true;
    const message = error instanceof Error ? error.message : String(error);
    return message === AI_SERVER_UNSTABLE;
}
