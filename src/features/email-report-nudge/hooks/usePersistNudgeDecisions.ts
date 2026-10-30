'use client';

import { useEffect } from 'react';
import { markNudgeShownThisSession } from '@/shared/lib/nudgeSession';
import { markSymbolNudged } from '../lib/memberNudgePolicy';
import {
    readMemberNudgeRecord,
    writeMemberNudgeRecord,
} from '../lib/memberNudgeStorage';
import {
    shouldRecordSetupOutcome,
    type SetupDecision,
    type SymbolPending,
} from '../lib/nudgeDecisions';

/**
 * `useEmailReportNudge`가 렌더 중에 내린 판정을 저장소에 남긴다. 판정은 렌더 중 조정
 * (REACT.md#EF-1)으로 상태에 고정하고, 저장소 쓰기는 여기 effect에서만 한다 — 렌더가 두 번
 * 돌아도(StrictMode) 기록이 두 번 남지 않는다. 기록은 판정한 회원의 id로 쓴다.
 *
 * - 설정 판정: 띄웠거나 이미 수신 중이면 `setupShown`을 남기고, 띄웠으면 세션 넛지 자리를 채운다.
 * - 종목 판정: 띄웠을 때만 그 종목과 시각을 남기고 세션 자리를 채운다. 꺼진 회원은 기록하지
 *   않는다 — 나중에 켜면 다시 후보가 된다.
 */
export function usePersistNudgeDecisions(
    setupDecision: SetupDecision | null,
    symbolPending: SymbolPending | null
): void {
    useEffect(() => {
        if (symbolPending === null || symbolPending.status !== 'shown') return;
        const { userId: decidedFor, symbol, at } = symbolPending;
        writeMemberNudgeRecord(
            decidedFor,
            markSymbolNudged(readMemberNudgeRecord(decidedFor), symbol, at)
        );
        markNudgeShownThisSession();
    }, [symbolPending]);

    useEffect(() => {
        if (setupDecision === null) return;
        const { userId: decidedFor, outcome } = setupDecision;
        if (!shouldRecordSetupOutcome(outcome)) return;
        writeMemberNudgeRecord(decidedFor, {
            ...readMemberNudgeRecord(decidedFor),
            setupShown: true,
        });
        if (outcome === 'shown') markNudgeShownThisSession();
    }, [setupDecision]);
}
