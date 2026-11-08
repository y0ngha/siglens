'use client';

import { useEffect, useState } from 'react';
import type { VocTrigger } from '@/entities/feedback/types';
import { subscribeAgentTurnCompleted } from '@/shared/lib/agentTurnCompletedSignal';
import {
    hasNudgeShownThisSession,
    markNudgeShownThisSession,
} from '@/shared/lib/nudgeSession';
import { subscribeSymbolAnalyzed } from '@/shared/lib/symbolAnalyzedSignal';
import {
    isVocPromptPending,
    markVocPrompted,
} from '@/shared/lib/vocPromptStorage';
import { VocPromptModal } from './VocPromptModal';

interface VocPromptHostProps {
    /**
     * 무엇이 "첫 AI 경험"인가. `analysis`는 종목 분석이 화면에 그려진 순간(siglens.io),
     * `agent_chat`은 시그렌즈 AI가 첫 답변을 끝낸 순간(ai.siglens.io).
     */
    readonly trigger: VocTrigger;
}

/** 결과를 읽을 시간을 준 뒤 띄운다. 분석이 그려지자마자 가리지 않는다. */
export const VOC_PROMPT_DELAY_MS = 2500;

type Subscribe = (listener: () => void) => () => void;

const SUBSCRIBE_BY_TRIGGER: Record<VocTrigger, Subscribe> = {
    analysis: listener => subscribeSymbolAnalyzed(() => listener()),
    agent_chat: subscribeAgentTurnCompleted,
};

/**
 * VOC 별점 모달의 호스트. 첫 AI 경험 신호를 한 번만 받아 잠시 뒤 모달을 연다. 이미 띄운 적이 있거나
 * (영구 기록) 이 탭 세션에 다른 넛지가 떴으면 아무것도 하지 않는다 - 한 세션에 모달은 하나뿐이다.
 * 이때 건너뛰어도 "띄웠다"를 적지 않으므로 다음 방문에서 다시 시도한다.
 *
 * 세션 플래그와 영구 기록은 신호를 받은 즉시(지연 전에) 함께 적고 모달만 지연 뒤에 연다. 가입
 * 넛지(`useAnonAnalysisNudge`)와 코치 마크(`useWatchlistCoachMark`)는 VOC가 대기 중이면 양보하고,
 * 여기서 세션 플래그를 세우면 같은 세션의 나머지 넛지도 물러난다 - 구독 순서와 무관하게 이 세션의
 * 슬롯은 VOC가 가진다. 지연 중에 이 호스트가 사라지면 그 세션의 모달은 건너뛴다.
 * 모든 E2E 스펙이 세션 플래그를 미리 심으므로 이 호스트가 그것을 존중해야 기존 클릭이 모달에
 * 막히지 않는다.
 */
export function VocPromptHost({ trigger }: VocPromptHostProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!isVocPromptPending()) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = SUBSCRIBE_BY_TRIGGER[trigger](() => {
            // 첫 신호만 본다. 그 뒤 신호마다 타이머를 새로 걸지 않는다.
            unsubscribe();
            if (!isVocPromptPending() || hasNudgeShownThisSession()) return;
            // 신호를 받은 즉시 세션을 선점한다. 지연 뒤에 확인하면 그 사이 같은 신호를 받은 다른
            // 넛지(코치 마크 등)가 세션 플래그를 먼저 세워 모달도 넛지도 못 보는 세션이 생긴다.
            markNudgeShownThisSession();
            markVocPrompted();
            timer = setTimeout(() => setOpen(true), VOC_PROMPT_DELAY_MS);
        });
        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, [trigger]);

    if (!open) return null;
    return <VocPromptModal trigger={trigger} onClose={() => setOpen(false)} />;
}
