/** 띄울 넛지. `setup`은 메일 리포트 설정 권유(보유∪관심 종목 수), `symbol`은 리포트 대상 밖 종목 담기 권유. */
export type EmailReportNudge =
    | { kind: 'setup'; symbolCount: number }
    | { kind: 'symbol'; symbol: string };

/**
 * 설정 넛지 처리 결과. `deferred`는 이번 탭 세션에 다른 넛지가 이미 떠서 미룬 경우다 —
 * 세션 플래그는 탭을 닫기 전에는 풀리지 않으므로, 같은 탭의 SPA 이동에서는 다시 판정하지
 * 않고 다음 세션(새 탭·재방문)에 권한다.
 */
export type SetupOutcome = 'shown' | 'alreadyEnabled' | 'deferred';

/**
 * 판정과 모달은 **어느 회원의 것인지**를 함께 들고 다닌다. 호스트는 루트 레이아웃에 계속
 * 마운트돼 있어서, 새로고침 없이 회원이 바뀌면(로그아웃 → 다른 계정 로그인) 앞 회원의
 * 판정이 새 회원 이름으로 저장되거나 앞 회원의 모달이 남을 수 있다.
 */
export interface SetupDecision {
    userId: string;
    outcome: SetupOutcome;
}

/**
 * 종목 넛지 후보. 담기 권유는 메일이 실제로 나갈 때만 약속이 되므로, 후보가 생긴 뒤에야
 * 수신 설정을 조회해 켜져 있을 때만 띄운다(`awaiting` → `shown`/`skipped`).
 */
export interface SymbolPending {
    userId: string;
    /** 대문자 심볼. */
    symbol: string;
    /** 후보가 생긴 시각(epoch ms) — 띄우면 종목 넛지 간격의 기준이 된다. */
    at: number;
    status: 'awaiting' | SymbolOutcome;
}

/** 종목 넛지 후보를 판정한 결과. */
export type SymbolOutcome = 'shown' | 'skipped';

/** {@link isSetupNudgeCandidate}가 보는 인증 회원의 현재 상태. */
export interface SetupCandidateInput {
    /** 보유종목을 실제로 받아 왔는지(빈 목록과 "모름"을 구분한다). */
    hasHoldings: boolean;
    /** 관심종목 목록이 확정됐는지. */
    isWatchlistKnown: boolean;
    /** 보유∪관심 종목 수. */
    symbolCount: number;
    /** 넛지를 띄우지 않는 경로인지(`isNudgeExcludedPath`). */
    isExcluded: boolean;
    /** 회원 기록에 설정 넛지를 이미 띄운 것으로 남아 있는지. */
    storedSetupShown: boolean;
    /** 이 탭에서 이 회원의 설정 판정을 이미 내렸는지. */
    isDecidedThisTab: boolean;
}

/**
 * 이메일 인증 회원이 설정 넛지 후보인지 — 후보일 때만 수신 설정을 조회한다. 보유·관심 목록을
 * 모르는 동안은 후보가 아니다: 빈 목록으로 판정하면 관심종목만 있는 회원에게 거짓 판정이 난다.
 */
export function isSetupNudgeCandidate(input: SetupCandidateInput): boolean {
    return (
        input.hasHoldings &&
        input.isWatchlistKnown &&
        input.symbolCount > 0 &&
        !input.isExcluded &&
        !input.storedSetupShown &&
        !input.isDecidedThisTab
    );
}

/**
 * 설정 넛지 후보의 판정. 띄울 조건(`shouldShowSetupNudge`)이 아니면 이미 수신 중인 회원이고,
 * 조건은 맞지만 이번 세션의 넛지 자리가 찼으면(다른 넛지가 떴거나 지금 열려 있음) 미룬다.
 */
export function decideSetupOutcome(
    shouldShow: boolean,
    isNudgeSlotTaken: boolean
): SetupOutcome {
    if (!shouldShow) return 'alreadyEnabled';
    if (isNudgeSlotTaken) return 'deferred';
    return 'shown';
}

/**
 * 수신 설정이 도착한 종목 넛지 후보의 판정. 수신이 꺼져 있으면 띄우지 않는다(설정 권유가
 * 맡는다). 이번 세션의 넛지 자리가 찼어도 띄우지 않는다.
 */
export function decideSymbolOutcome(
    reportEnabled: boolean,
    isNudgeSlotTaken: boolean
): SymbolOutcome {
    return reportEnabled && !isNudgeSlotTaken ? 'shown' : 'skipped';
}

/**
 * 설정 판정을 회원 기록(`setupShown`)에 남길지. 미룬 경우는 남기지 않는다 — 다음 세션에
 * 다시 권한다. 이미 수신 중인 회원은 남겨, 다음부터 수신 설정을 조회하지 않는다.
 */
export function shouldRecordSetupOutcome(outcome: SetupOutcome): boolean {
    return outcome !== 'deferred';
}
