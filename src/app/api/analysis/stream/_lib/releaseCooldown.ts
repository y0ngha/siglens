import { releaseReanalyzeCooldown, type Timeframe } from '@y0ngha/siglens-core';

/**
 * 실패한 분석이 잡고 있던 재분석 쿨다운을 **서버가** 되돌린다. 안 되돌리면 사용자는 결과도 못 받은 채
 * 5분간 재분석이 막힌다. 해제 자체가 실패해도 원래 실패를 가리지 않도록 삼키고 `logTag`로 기록한다.
 *
 * 해제를 클라이언트에 맡기지 않는다: 그러려면 인증 없는 공개 서버 액션으로 열어야 하는데, 그 순간
 * "해제 → 재요청"을 반복해 쿨다운을 무력화할 수 있다 — 이 쿨다운이 공개 라우트에서 캐시 우회 LLM
 * 호출을 막는 유일한 장치다. 또 클라이언트 쪽 실패(탭 이동으로 인한 fetch abort 등)는 서버 작업이
 * 여전히 살아 있는 상태라 해제 대상이 아니다. core에서 직접 import하는 이유도 같다.
 */
export async function releaseCooldownQuietly(
    symbol: string,
    timeframe: Timeframe,
    logTag: string
): Promise<void> {
    try {
        await releaseReanalyzeCooldown(symbol, timeframe);
    } catch (err) {
        console.error(logTag, err);
    }
}
