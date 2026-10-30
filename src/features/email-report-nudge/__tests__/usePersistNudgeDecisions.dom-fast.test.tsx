import { renderHook } from '@testing-library/react';
import { usePersistNudgeDecisions } from '@/features/email-report-nudge/hooks/usePersistNudgeDecisions';
import {
    EMPTY_MEMBER_NUDGE_RECORD,
    type MemberNudgeRecord,
} from '@/features/email-report-nudge/lib/memberNudgePolicy';
import {
    readMemberNudgeRecord,
    writeMemberNudgeRecord,
} from '@/features/email-report-nudge/lib/memberNudgeStorage';
import type {
    SetupDecision,
    SymbolPending,
} from '@/features/email-report-nudge/lib/nudgeDecisions';
import { hasNudgeShownThisSession } from '@/shared/lib/nudgeSession';

const AT = 1_700_000_000_000;
const RECORD: MemberNudgeRecord = {
    ...EMPTY_MEMBER_NUDGE_RECORD,
    symbolCounts: { TSLA: 3 },
};

function pending(status: SymbolPending['status']): SymbolPending {
    return { userId: 'u-1', symbol: 'TSLA', at: AT, status };
}

describe('usePersistNudgeDecisions', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        writeMemberNudgeRecord('u-1', RECORD);
    });

    describe('종목 판정', () => {
        it('띄운 종목은 기존 기록을 살려 그 종목과 시각을 남긴다', () => {
            renderHook(() => usePersistNudgeDecisions(null, pending('shown')));

            expect(readMemberNudgeRecord('u-1')).toEqual({
                ...RECORD,
                symbolsNudged: ['TSLA'],
                lastSymbolNudgeAt: AT,
            });
        });

        it('띄운 종목은 이번 세션의 넛지 자리를 채운다', () => {
            renderHook(() => usePersistNudgeDecisions(null, pending('shown')));

            expect(hasNudgeShownThisSession()).toBe(true);
        });

        it.each(['awaiting', 'skipped'] as const)(
            '%s면 기록도 세션 자리도 건드리지 않는다',
            status => {
                renderHook(() =>
                    usePersistNudgeDecisions(null, pending(status))
                );

                expect([
                    readMemberNudgeRecord('u-1'),
                    hasNudgeShownThisSession(),
                ]).toEqual([RECORD, false]);
            }
        );
    });

    describe('설정 판정', () => {
        const decision = (
            outcome: SetupDecision['outcome']
        ): SetupDecision => ({
            userId: 'u-1',
            outcome,
        });

        it('띄웠으면 setupShown을 남기고 세션 자리를 채운다', () => {
            renderHook(() => usePersistNudgeDecisions(decision('shown'), null));

            expect([
                readMemberNudgeRecord('u-1'),
                hasNudgeShownThisSession(),
            ]).toEqual([{ ...RECORD, setupShown: true }, true]);
        });

        it('이미 수신 중이면 setupShown만 남기고 세션 자리는 비워 둔다', () => {
            renderHook(() =>
                usePersistNudgeDecisions(decision('alreadyEnabled'), null)
            );

            expect([
                readMemberNudgeRecord('u-1'),
                hasNudgeShownThisSession(),
            ]).toEqual([{ ...RECORD, setupShown: true }, false]);
        });

        it('미뤘으면 기록하지 않는다', () => {
            renderHook(() =>
                usePersistNudgeDecisions(decision('deferred'), null)
            );

            expect(readMemberNudgeRecord('u-1')).toEqual(RECORD);
        });

        it('판정한 회원의 id로만 쓴다', () => {
            renderHook(() =>
                usePersistNudgeDecisions(
                    { userId: 'u-2', outcome: 'shown' },
                    null
                )
            );

            expect([
                readMemberNudgeRecord('u-1').setupShown,
                readMemberNudgeRecord('u-2').setupShown,
            ]).toEqual([false, true]);
        });
    });
});
