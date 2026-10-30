import { act, renderHook } from '@testing-library/react';
import {
    useSymbolNudgeCandidates,
    type SymbolNudgeCandidateInput,
} from '@/features/email-report-nudge/hooks/useSymbolNudgeCandidates';
import {
    EMPTY_MEMBER_NUDGE_RECORD,
    SYMBOL_NUDGE_MIN_ANALYSES,
} from '@/features/email-report-nudge/lib/memberNudgePolicy';
import { readMemberNudgeRecord } from '@/features/email-report-nudge/lib/memberNudgeStorage';
import { markNudgeShownThisSession } from '@/shared/lib/nudgeSession';
import { publishSymbolAnalyzed } from '@/shared/lib/symbolAnalyzedSignal';

const MEMBER = { id: 'u-1', emailVerified: true };

function makeInput(
    overrides: Partial<SymbolNudgeCandidateInput> = {}
): SymbolNudgeCandidateInput {
    return {
        user: MEMBER,
        holdings: [{ symbol: 'AAPL' }],
        hasHoldings: true,
        isWatchlistKnown: true,
        isWatched: () => false,
        reportOffUserId: null,
        onCandidate: vi.fn(),
        ...overrides,
    };
}

function analyze(symbol: string, times: number): void {
    act(() => {
        Array.from({ length: times }).forEach(() =>
            publishSymbolAnalyzed(symbol)
        );
    });
}

describe('useSymbolNudgeCandidates', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('리포트 대상 밖 종목의 분석 횟수를 대문자 심볼로 쌓는다', () => {
        renderHook(() => useSymbolNudgeCandidates(makeInput()));

        analyze('tsla', 2);

        expect(readMemberNudgeRecord('u-1').symbolCounts).toEqual({ TSLA: 2 });
    });

    it(`${SYMBOL_NUDGE_MIN_ANALYSES}번째 분석에서 후보를 알린다`, () => {
        const onCandidate = vi.fn();
        renderHook(() => useSymbolNudgeCandidates(makeInput({ onCandidate })));

        analyze('tsla', SYMBOL_NUDGE_MIN_ANALYSES);

        expect(onCandidate).toHaveBeenCalledWith({
            userId: 'u-1',
            symbol: 'TSLA',
            at: expect.any(Number),
        });
    });

    it('신호 처리기는 마지막 렌더의 입력을 읽는다', () => {
        const onCandidate = vi.fn();
        const { rerender } = renderHook(
            input => useSymbolNudgeCandidates(input),
            { initialProps: makeInput({ onCandidate }) }
        );

        rerender(makeInput({ onCandidate, reportOffUserId: 'u-1' }));
        analyze('tsla', SYMBOL_NUDGE_MIN_ANALYSES);

        expect(onCandidate).not.toHaveBeenCalled();
    });

    it('보유종목 안 종목은 세지 않는다', () => {
        renderHook(() => useSymbolNudgeCandidates(makeInput()));

        analyze('aapl', 1);

        expect(readMemberNudgeRecord('u-1')).toEqual(EMPTY_MEMBER_NUDGE_RECORD);
    });

    it.each([
        ['비회원', { user: null }],
        ['이메일 미인증', { user: { ...MEMBER, emailVerified: false } }],
        ['보유종목 모름', { hasHoldings: false }],
        ['관심종목 모름', { isWatchlistKnown: false }],
    ] as const)('%s이면 세지 않는다', (_, overrides) => {
        renderHook(() => useSymbolNudgeCandidates(makeInput(overrides)));

        analyze('tsla', 1);

        expect(readMemberNudgeRecord('u-1')).toEqual(EMPTY_MEMBER_NUDGE_RECORD);
    });

    it('이번 세션에 넛지가 이미 떴으면 세기만 하고 후보를 알리지 않는다', () => {
        markNudgeShownThisSession();
        const onCandidate = vi.fn();
        renderHook(() => useSymbolNudgeCandidates(makeInput({ onCandidate })));

        analyze('tsla', SYMBOL_NUDGE_MIN_ANALYSES);

        expect(onCandidate).not.toHaveBeenCalled();
    });

    it('언마운트하면 구독을 푼다', () => {
        const { unmount } = renderHook(() =>
            useSymbolNudgeCandidates(makeInput())
        );
        unmount();

        analyze('tsla', 1);

        expect(readMemberNudgeRecord('u-1')).toEqual(EMPTY_MEMBER_NUDGE_RECORD);
    });
});
