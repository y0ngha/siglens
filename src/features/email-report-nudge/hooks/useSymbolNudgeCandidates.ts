'use client';

import { useEffect, useEffectEvent } from 'react';
import { hasNudgeShownThisSession } from '@/shared/lib/nudgeSession';
import { subscribeSymbolAnalyzed } from '@/shared/lib/symbolAnalyzedSignal';
import { recordSymbolAnalysis } from '../lib/memberNudgePolicy';
import {
    readMemberNudgeRecord,
    writeMemberNudgeRecord,
} from '../lib/memberNudgeStorage';
import { isInReportSet } from '../lib/reportSet';

/** {@link useSymbolNudgeCandidates}가 분석 신호를 받을 때 읽는 현재 회원·리포트 대상 상태. */
export interface SymbolNudgeCandidateInput {
    /** 현재 회원(`useCurrentUser().data`). 비회원은 `null`, 확인 전은 `undefined`. */
    user: { id: string; emailVerified: boolean } | null | undefined;
    holdings: readonly { symbol: string }[];
    /** 보유종목을 실제로 받아 왔는지 — 모르면 리포트 대상 밖인지 판정할 수 없다. */
    hasHoldings: boolean;
    /** 관심종목 목록이 확정됐는지(하이드레이션·회원 여부 확정). */
    isWatchlistKnown: boolean;
    isWatched: (symbol: string) => boolean;
    /** 이 탭에서 수신이 꺼진 것으로 확인된 회원 id. 그 회원은 후보를 만들지 않는다. */
    reportOffUserId: string | null;
    /** 후보가 생겼을 때. 대문자 심볼과 그 분석 시각(epoch ms)을 받는다. */
    onCandidate: (candidate: {
        userId: string;
        symbol: string;
        at: number;
    }) => void;
}

/**
 * 차트 탭이 보내는 "종목 분석이 그려졌다" 신호(`symbolAnalyzedSignal`)를 구독해, 리포트 대상
 * (보유∪관심) 밖 종목의 분석 횟수를 회원 기록에 쌓고 종목 넛지 후보를 알린다.
 *
 * 이메일 인증 회원만 센다 — 인증 전에는 담아도 메일이 나가지 않으므로 권하지 않고, 인증 전
 * 분석 횟수도 쌓지 않는다. 횟수는 계속 쌓되, 이번 세션에 넛지가 이미 떴거나 수신이 꺼진
 * 것으로 확인된 회원은 후보(= 수신 설정 조회)를 만들지 않는다.
 *
 * 구독은 마운트 동안 한 번만 건다. 신호 처리기는 `useEffectEvent`라 항상 이번 렌더의 입력을 읽는다.
 */
export function useSymbolNudgeCandidates(
    input: SymbolNudgeCandidateInput
): void {
    const handleAnalyzed = useEffectEvent((symbol: string): void => {
        const {
            user,
            holdings,
            hasHoldings,
            isWatchlistKnown,
            isWatched,
            reportOffUserId,
            onCandidate,
        } = input;
        if (user == null || !user.emailVerified) return;
        if (!hasHoldings || !isWatchlistKnown) return;
        const upper = symbol.toUpperCase();
        const now = Date.now();
        const { record, shouldNudge } = recordSymbolAnalysis(
            readMemberNudgeRecord(user.id),
            upper,
            isInReportSet(upper, holdings, isWatched),
            now
        );
        writeMemberNudgeRecord(user.id, record);
        if (
            shouldNudge &&
            !hasNudgeShownThisSession() &&
            reportOffUserId !== user.id
        ) {
            onCandidate({ userId: user.id, symbol: upper, at: now });
        }
    });

    useEffect(
        () => subscribeSymbolAnalyzed(symbol => handleAnalyzed(symbol)),
        []
    );
}
