import {
    decideSetupOutcome,
    decideSymbolOutcome,
    isSetupNudgeCandidate,
    shouldRecordSetupOutcome,
    type SetupCandidateInput,
} from '@/features/email-report-nudge/lib/nudgeDecisions';

describe('decideSetupOutcome', () => {
    it('띄울 조건이 아니면 넛지 자리와 상관없이 alreadyEnabled', () => {
        expect(decideSetupOutcome(false, true)).toBe('alreadyEnabled');
    });

    it('띄울 조건이지만 넛지 자리가 찼으면 deferred', () => {
        expect(decideSetupOutcome(true, true)).toBe('deferred');
    });

    it('띄울 조건이고 자리가 비었으면 shown', () => {
        expect(decideSetupOutcome(true, false)).toBe('shown');
    });
});

describe('decideSymbolOutcome', () => {
    it('수신이 켜져 있고 자리가 비었으면 shown', () => {
        expect(decideSymbolOutcome(true, false)).toBe('shown');
    });

    it('수신이 꺼져 있으면 skipped', () => {
        expect(decideSymbolOutcome(false, false)).toBe('skipped');
    });

    it('넛지 자리가 찼으면 skipped', () => {
        expect(decideSymbolOutcome(true, true)).toBe('skipped');
    });
});

describe('shouldRecordSetupOutcome', () => {
    it.each([
        ['shown', true],
        ['alreadyEnabled', true],
        ['deferred', false],
    ] as const)('%s → %s', (outcome, expected) => {
        expect(shouldRecordSetupOutcome(outcome)).toBe(expected);
    });
});

describe('isSetupNudgeCandidate', () => {
    const CANDIDATE: SetupCandidateInput = {
        hasHoldings: true,
        isWatchlistKnown: true,
        symbolCount: 2,
        isExcluded: false,
        storedSetupShown: false,
        isDecidedThisTab: false,
    };

    it('보유·관심을 알고 종목이 있으며 아직 판정 전이면 후보다', () => {
        expect(isSetupNudgeCandidate(CANDIDATE)).toBe(true);
    });

    it.each([
        ['보유종목 모름', { hasHoldings: false }],
        ['관심종목 모름', { isWatchlistKnown: false }],
        ['종목 없음', { symbolCount: 0 }],
        ['제외 경로', { isExcluded: true }],
        ['이미 띄움(기록)', { storedSetupShown: true }],
        ['이 탭에서 이미 판정', { isDecidedThisTab: true }],
    ] as const)('%s이면 후보가 아니다', (_, overrides) => {
        expect(isSetupNudgeCandidate({ ...CANDIDATE, ...overrides })).toBe(
            false
        );
    });
});
