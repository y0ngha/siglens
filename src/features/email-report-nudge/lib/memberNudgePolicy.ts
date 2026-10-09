/** 리포트 대상(보유∪관심) 밖 종목을 몇 번 분석하면 "관심종목에 담아 메일로 받기"를 권하는지(누적). */
export const SYMBOL_NUDGE_MIN_ANALYSES = 3;
/** 종목 넛지끼리의 최소 간격. 누적 횟수는 한 번 넘기면 계속 넘으므로 상한이 필요하다. */
export const SYMBOL_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** 회원 한 명의 넛지 기록(localStorage, 회원 id별). */
export interface MemberNudgeRecord {
    /** "메일 리포트 설정하기" 넛지를 이미 띄웠는지 — 회원당 1회. */
    setupShown: boolean;
    /** 리포트 대상(보유∪관심) 밖 종목의 누적 분석 횟수(대문자 심볼 키). */
    symbolCounts: Record<string, number>;
    /** 종목 넛지를 이미 띄운 심볼 — 같은 종목에는 다시 띄우지 않는다. */
    symbolsNudged: string[];
    /** 마지막 종목 넛지 시각(epoch ms). */
    lastSymbolNudgeAt: number | null;
}

export const EMPTY_MEMBER_NUDGE_RECORD: MemberNudgeRecord = {
    setupShown: false,
    symbolCounts: {},
    symbolsNudged: [],
    lastSymbolNudgeAt: null,
};

export interface SetupNudgeContext {
    emailVerified: boolean;
    holdingsCount: number;
    /** 관심종목 수. 보유가 없어도 관심종목이 있으면 리포트 대상이다. */
    watchlistCount: number;
    /** 메일 리포트 수신이 켜져 있는지. 아직 모르면 `null`(넛지 보류). */
    reportEnabled: boolean | null;
}

/**
 * "보유·관심종목 리포트를 메일로 받아보세요" 넛지를 띄울지.
 *
 * 인증되지 않은 주소에는 메일이 나가지 않으므로(발송 대상 조건) 권하지 않는다 — 켜 봐야
 * 받지 못하는 기능을 권하면 신뢰를 잃는다. 수신 여부를 아직 모르면 기다린다.
 */
export function shouldShowSetupNudge(
    record: MemberNudgeRecord,
    ctx: SetupNudgeContext
): boolean {
    return (
        !record.setupShown &&
        ctx.emailVerified &&
        ctx.holdingsCount + ctx.watchlistCount > 0 &&
        ctx.reportEnabled === false
    );
}

export interface SymbolAnalysisOutcome {
    record: MemberNudgeRecord;
    shouldNudge: boolean;
}

/**
 * 리포트 대상(보유∪관심) 밖 종목 분석 1회를 기록하고, 이번에 종목 넛지를 띄울지 정한다.
 *
 * 리포트 대상 안 종목은 세지 않는다 — 이미 리포트 대상이다. 같은 종목에는 한 번만,
 * 종목 넛지끼리는 {@link SYMBOL_NUDGE_COOLDOWN_MS} 간격을 둔다. 띄우기로 하면 기록에
 * 반영해 돌려준다(호출자가 저장한다).
 */
export function recordSymbolAnalysis(
    record: MemberNudgeRecord,
    symbol: string,
    inReportSet: boolean,
    now: number
): SymbolAnalysisOutcome {
    if (inReportSet) return { record, shouldNudge: false };
    const key = symbol.toUpperCase();
    const count = (record.symbolCounts[key] ?? 0) + 1;
    const counted: MemberNudgeRecord = {
        ...record,
        symbolCounts: { ...record.symbolCounts, [key]: count },
    };
    const cooledDown =
        record.lastSymbolNudgeAt === null ||
        now - record.lastSymbolNudgeAt >= SYMBOL_NUDGE_COOLDOWN_MS;
    const shouldNudge =
        count >= SYMBOL_NUDGE_MIN_ANALYSES &&
        !record.symbolsNudged.includes(key) &&
        cooledDown;
    return { record: counted, shouldNudge };
}

/** 종목 넛지를 실제로 띄웠을 때의 기록. */
export function markSymbolNudged(
    record: MemberNudgeRecord,
    symbol: string,
    now: number
): MemberNudgeRecord {
    return {
        ...record,
        symbolsNudged: [...record.symbolsNudged, symbol.toUpperCase()],
        lastSymbolNudgeAt: now,
    };
}
