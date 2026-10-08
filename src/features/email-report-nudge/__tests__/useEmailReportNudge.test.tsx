const state = vi.hoisted(() => ({
    user: undefined as unknown,
    holdings: [] as Array<{ symbol: string }>,
    holdingsLoading: false,
    settings: undefined as unknown,
    pathname: '/AAPL',
    settingsEnabledArgs: [] as boolean[],
    holdingsEnabledArgs: [] as boolean[],
}));

vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: () => ({ data: state.user }),
}));
vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings', () => ({
    usePortfolioHoldings: ({ enabled }: { enabled: boolean }) => {
        state.holdingsEnabledArgs.push(enabled);
        return {
            holdings: state.holdingsLoading ? [] : state.holdings,
            hasData: !state.holdingsLoading,
        };
    },
}));
vi.mock('@/entities/email-report/hooks/useEmailReportSettings', () => ({
    useEmailReportSettings: ({ enabled }: { enabled: boolean }) => {
        state.settingsEnabledArgs.push(enabled);
        return { settings: enabled ? state.settings : undefined };
    },
}));
vi.mock('@/shared/i18n/useAppPathname', () => ({
    useAppPathname: () => state.pathname,
}));

import { act, renderHook } from '@testing-library/react';
import { useEmailReportNudge } from '@/features/email-report-nudge/hooks/useEmailReportNudge';
import {
    readMemberNudgeRecord,
    writeMemberNudgeRecord,
} from '@/features/email-report-nudge/lib/memberNudgeStorage';
import {
    EMPTY_MEMBER_NUDGE_RECORD,
    SYMBOL_NUDGE_MIN_ANALYSES,
} from '@/features/email-report-nudge/lib/memberNudgePolicy';
import {
    hasNudgeShownThisSession,
    markNudgeShownThisSession,
} from '@/shared/lib/nudgeSession';
import { publishSymbolAnalyzed } from '@/shared/lib/symbolAnalyzedSignal';

const MEMBER = { id: 'u-1', emailVerified: true };
const OFF = {
    enabled: false,
    daysOfWeek: [1],
    sendHour: 8,
    timezone: 'Asia/Seoul',
    isSaved: true,
};

describe('useEmailReportNudge', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        state.user = MEMBER;
        state.holdings = [{ symbol: 'AAPL' }, { symbol: 'MSFT' }];
        state.holdingsLoading = false;
        state.settings = OFF;
        state.pathname = '/AAPL';
        state.settingsEnabledArgs = [];
        state.holdingsEnabledArgs = [];
    });

    describe('설정 권유', () => {
        it('포트폴리오가 있고 수신이 꺼진 인증 회원에게 보유 종목 수와 함께 한 번 띄우고 기록한다', () => {
            const { result } = renderHook(() => useEmailReportNudge());

            expect(result.current.nudge).toEqual({
                kind: 'setup',
                holdingsCount: 2,
            });
            expect(readMemberNudgeRecord('u-1').setupShown).toBe(true);
            expect(hasNudgeShownThisSession()).toBe(true);
        });

        it('이미 띄운 회원은 수신 설정도 보유종목도 직접 조회하지 않는다', () => {
            writeMemberNudgeRecord('u-1', {
                ...EMPTY_MEMBER_NUDGE_RECORD,
                setupShown: true,
            });

            const { result } = renderHook(() => useEmailReportNudge());

            expect(result.current.nudge).toBeNull();
            expect(state.settingsEnabledArgs.every(e => !e)).toBe(true);
            expect(state.holdingsEnabledArgs.every(e => !e)).toBe(true);
        });

        it('판정 전인 인증 회원은 보유종목을 조회한다', () => {
            renderHook(() => useEmailReportNudge());

            expect(state.holdingsEnabledArgs[0]).toBe(true);
        });

        it('이미 수신 중이면 띄우지 않고, 다시 조회하지 않도록 기록한다', () => {
            state.settings = { ...OFF, enabled: true };

            const { result } = renderHook(() => useEmailReportNudge());

            expect(result.current.nudge).toBeNull();
            expect(readMemberNudgeRecord('u-1').setupShown).toBe(true);
        });

        it('이번 세션에 다른 넛지가 이미 떴으면 미루고, 다음 세션을 위해 기록하지 않는다', () => {
            markNudgeShownThisSession();

            const { result } = renderHook(() => useEmailReportNudge());

            expect(result.current.nudge).toBeNull();
            expect(readMemberNudgeRecord('u-1').setupShown).toBe(false);
        });

        it.each([
            ['비회원', () => (state.user = null)],
            [
                '이메일 미인증',
                () => (state.user = { ...MEMBER, emailVerified: false }),
            ],
            ['보유 종목 없음', () => (state.holdings = [])],
            ['보유 종목 로딩 중', () => (state.holdingsLoading = true)],
            ['계정 페이지', () => (state.pathname = '/account')],
            [
                '수신거부 페이지',
                () => (state.pathname = '/email-report/unsubscribe'),
            ],
        ])('%s이면 조회하지도 띄우지도 않는다', (_, arrange) => {
            arrange();

            const { result } = renderHook(() => useEmailReportNudge());

            expect(result.current.nudge).toBeNull();
            expect(state.settingsEnabledArgs.every(e => !e)).toBe(true);
        });

        it('새로고침 없이 회원이 바뀌면 앞 회원의 모달을 숨기고 판정을 새 회원 이름으로 쓰지 않는다', () => {
            const { result, rerender } = renderHook(() =>
                useEmailReportNudge()
            );
            expect(result.current.nudge).toEqual({
                kind: 'setup',
                holdingsCount: 2,
            });

            state.user = { id: 'u-2', emailVerified: true };
            rerender();

            // 같은 탭에서 이미 넛지가 떴으므로 u-2는 이번 세션엔 미뤄진다.
            expect(result.current.nudge).toBeNull();
            expect(readMemberNudgeRecord('u-1').setupShown).toBe(true);
            expect(readMemberNudgeRecord('u-2').setupShown).toBe(false);
        });

        it('close는 모달을 닫고 다시 띄우지 않는다', () => {
            const { result, rerender } = renderHook(() =>
                useEmailReportNudge()
            );
            act(() => result.current.close());
            rerender();

            expect(result.current.nudge).toBeNull();
        });
    });

    describe('종목 담기 권유', () => {
        beforeEach(() => {
            writeMemberNudgeRecord('u-1', {
                ...EMPTY_MEMBER_NUDGE_RECORD,
                setupShown: true,
            });
        });

        it(`포트폴리오 밖 종목을 ${SYMBOL_NUDGE_MIN_ANALYSES}번 분석하면 그 종목으로 띄운다`, () => {
            const { result } = renderHook(() => useEmailReportNudge());

            act(() => {
                for (let i = 0; i < SYMBOL_NUDGE_MIN_ANALYSES; i += 1) {
                    publishSymbolAnalyzed('tsla');
                }
            });

            expect(result.current.nudge).toEqual({
                kind: 'symbol',
                symbol: 'TSLA',
            });
            expect(readMemberNudgeRecord('u-1').symbolsNudged).toEqual([
                'TSLA',
            ]);
        });

        it('포트폴리오 안 종목은 아무리 분석해도 띄우지 않는다', () => {
            const { result } = renderHook(() => useEmailReportNudge());

            act(() => {
                for (let i = 0; i < SYMBOL_NUDGE_MIN_ANALYSES + 2; i += 1) {
                    publishSymbolAnalyzed('AAPL');
                }
            });

            expect(result.current.nudge).toBeNull();
            expect(readMemberNudgeRecord('u-1').symbolCounts).toEqual({});
        });

        it('이번 세션에 넛지가 이미 떴으면 세기만 하고 띄우지 않는다', () => {
            markNudgeShownThisSession();
            const { result } = renderHook(() => useEmailReportNudge());

            act(() => {
                for (let i = 0; i < SYMBOL_NUDGE_MIN_ANALYSES; i += 1) {
                    publishSymbolAnalyzed('TSLA');
                }
            });

            expect(result.current.nudge).toBeNull();
            expect(readMemberNudgeRecord('u-1').symbolCounts.TSLA).toBe(
                SYMBOL_NUDGE_MIN_ANALYSES
            );
        });

        it('보유종목을 아직 모르면 포트폴리오 밖인지 판정할 수 없어 세지 않는다', () => {
            state.holdingsLoading = true;
            const { result } = renderHook(() => useEmailReportNudge());

            act(() => publishSymbolAnalyzed('TSLA'));

            expect(result.current.nudge).toBeNull();
            expect(readMemberNudgeRecord('u-1').symbolCounts).toEqual({});
        });

        it('비회원 분석 신호는 무시한다', () => {
            state.user = null;
            const { result } = renderHook(() => useEmailReportNudge());

            act(() => publishSymbolAnalyzed('TSLA'));

            expect(result.current.nudge).toBeNull();
            expect(localStorage.length).toBe(1); // beforeEach의 기록뿐
        });

        it('언마운트 뒤에는 구독이 풀린다', () => {
            const { unmount } = renderHook(() => useEmailReportNudge());
            unmount();

            act(() => publishSymbolAnalyzed('TSLA'));

            expect(readMemberNudgeRecord('u-1').symbolCounts).toEqual({});
        });
    });
});
