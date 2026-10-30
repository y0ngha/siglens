/**
 * 인스턴스당 동시에 돌 수 있는 에이전트 턴의 상한. 카운터는 프로세스(인스턴스)
 * 단위 모듈 상태라 인스턴스 사이에 공유되지 않고, 모듈이 다시 평가되면(새
 * 인스턴스·HMR) 0에서 다시 센다. 인스턴스 전체를 묶는 상한이 아니다.
 */
export const MAX_CONCURRENT_AGENT_TURNS = 4;

let activeAgentTurns = 0;

/** 현재 인스턴스에서 진행 중인(슬롯을 쥔) 턴 수 — 용량 거절 로그에 싣는다. */
export function getActiveAgentTurns(): number {
    return activeAgentTurns;
}

/** 슬롯이 남아 있는지. 확인과 예약({@link reserveTurnSlot})은 await 없이 이어서 호출한다. */
export function hasFreeTurnSlot(): boolean {
    return activeAgentTurns < MAX_CONCURRENT_AGENT_TURNS;
}

/**
 * 슬롯 하나를 예약하고 반납 함수를 돌려준다. 반납은 몇 번 불러도 한 번만
 * 줄어든다 — 오류 경로와 턴 종료 경로가 겹쳐도 카운터가 어긋나지 않는다.
 */
export function reserveTurnSlot(): () => void {
    activeAgentTurns += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        activeAgentTurns -= 1;
    };
}
