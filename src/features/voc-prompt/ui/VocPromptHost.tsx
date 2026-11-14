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
    claimVocPrompt,
    isVocPromptRetired,
    markVocShown,
    recordVocUse,
} from '@/shared/lib/vocPromptStorage';
import { VocPromptModal } from './VocPromptModal';

interface VocPromptHostProps {
    /**
     * 무엇을 "이용 한 번"으로 세는가. `analysis`는 종목 분석이 화면에 그려진 순간(siglens.io,
     * 같은 종목은 한 번), `agent_chat`은 시그렌즈 AI가 답변 한 턴을 끝낸 순간(ai.siglens.io).
     * 몇 번에 묻는지는 `VOC_PROMPT_POLICY`(`shared/lib/vocPromptStorage.ts`).
     */
    readonly trigger: VocTrigger;
}

/**
 * 신호 뒤 모달을 열기까지 기다리는 시간.
 *
 * `analysis`가 긴 이유: 종목 페이지는 미리 저장된 분석을 첫 페인트에 그리므로 신호가 진입 직후에
 * 온다. 2.5초에 열면 검색에서 막 들어온 방문자가 본문을 읽기도 전에 전체 화면 모달을 만나고
 * (써 보기 전에 "써 보니 어떠세요?"를 묻게 된다), 모달이 그 페이지의 LCP 요소가 된다(2026-11-14
 * 운영 Lighthouse: `/AAPL` LCP 8.8초, `/005930.KS` 13.0초 - LCP 요소가 모달의 textarea
 * placeholder였다). `agent_chat`은 방문자가 직접 질문하고 답을 다 받은 뒤라 짧게 둔다.
 */
export const VOC_PROMPT_DELAY_MS: Record<VocTrigger, number> = {
    analysis: 20_000,
    agent_chat: 2_500,
};

/**
 * "이 방문자가 페이지를 쓰고 있다"로 치는 입력 — **사람의 입력으로만 생기는 이벤트**다.
 *
 * 브라우저는 탭·스크롤·키 입력 뒤로는 LCP 후보를 더 받지 않으므로, 첫 입력 뒤에 여는 모달은 LCP가
 * 될 수 없다. 입력이 없는 렌더러(검색 크롤러, 측정 도구)는 모달을 보지 않는다 - UA를 가려내지 않고도
 * 색인되는 화면이 본문 그대로 남는다.
 *
 * `scroll`·`click`은 쓰지 않는다. 스크롤 복원이나 `scrollIntoView` 같은 스크립트 스크롤도 `scroll`을
 * 내서, 입력이 없는 렌더러에서도 조건이 채워진다. 터치 스크롤은 `touchstart`, 휠 스크롤은 `wheel`,
 * 키보드 스크롤은 `keydown`으로 잡힌다.
 */
const ENGAGEMENT_EVENTS = [
    'pointerdown',
    'touchstart',
    'wheel',
    'keydown',
] as const;

// capture: 안쪽에서 전파를 멈추는 컨트롤의 입력도 window에서 받는다. passive: 듣기만 한다.
const LISTENER_OPTIONS = { capture: true, passive: true } as const;

/**
 * 지연이 끝난 **뒤에** 첫 입력이 온 경우 그 입력에서 모달까지 두는 틈.
 *
 * 입력과 같은 순간에 열면 방문자가 막 시작한 동작(링크 누르기, 검색창 열기)을 모달이 가로챈다.
 * 그 동작이 끝날 시간을 준다.
 */
export const VOC_PROMPT_SETTLE_MS = 3_000;

/** 방문자가 입력 중일 때 모달을 미루는 간격과 횟수. 다 쓰면 이 세션에는 열지 않는다. */
export const VOC_PROMPT_TYPING_RETRY_MS = 5_000;
export const VOC_PROMPT_TYPING_RETRIES = 3;

/** `key`는 같은 이용을 두 번 세지 않기 위한 값(종목 코드). 없으면 신호마다 한 번으로 센다. */
type Subscribe = (listener: (key?: string) => void) => () => void;

const SUBSCRIBE_BY_TRIGGER: Record<VocTrigger, Subscribe> = {
    analysis: subscribeSymbolAnalyzed,
    agent_chat: listener => subscribeAgentTurnCompleted(() => listener()),
};

/** 첫 입력에 한 번 `onEngaged`를 부른다. 반환값은 리스너 해제. */
function listenForFirstEngagement(onEngaged: () => void): () => void {
    function handle() {
        stop();
        onEngaged();
    }
    function stop() {
        ENGAGEMENT_EVENTS.forEach(type =>
            window.removeEventListener(type, handle, LISTENER_OPTIONS)
        );
    }
    ENGAGEMENT_EVENTS.forEach(type =>
        window.addEventListener(type, handle, LISTENER_OPTIONS)
    );
    return stop;
}

/**
 * 방문자가 글자를 넣고 있는가 — 이때 모달을 열면 포커스 트랩이 입력을 가로챈다.
 *
 * 포커스만으로 판정하지 않는다. 시그렌즈 AI의 입력창은 질문을 보낸 뒤에도 포커스를 쥐고 있어서,
 * 포커스만 보면 그 화면에서는 모달이 영영 열리지 않는다. 내용이 있는 입력란만 "입력 중"으로 본다.
 */
function isTyping(): boolean {
    const active = document.activeElement;
    if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
    ) {
        return active.value !== '';
    }
    return (
        active instanceof HTMLElement &&
        active.isContentEditable &&
        (active.textContent ?? '') !== ''
    );
}

/**
 * VOC 별점 모달의 호스트. 이용 신호를 셀 때마다 "써 보고 쓸모를 느낀 뒤"인지 묻고
 * (`recordVocUse` - 여러 번 썼거나 다른 날 다시 왔다), 그렇게 된 신호에서 **지연이 지났고 방문자가
 * 페이지를 한 번이라도 조작했을 때** 모달을 연다. 이 탭 세션에 다른 넛지가 떴으면 열지 않고
 * 다음 세션으로 미룬다 - 한 세션에 모달은 하나뿐이고, 조건은 채워진 채로 남는다.
 *
 * 세션 플래그와 "묻기로 했다" 기록(`claimVocPrompt`)은 그 신호를 받은 즉시(지연 전에) 함께 적고
 * 모달만 나중에 연다. 가입
 * 넛지(`useAnonAnalysisNudge`)와 코치 마크(`useWatchlistCoachMark`)는 같은 신호에서
 * `isVocPromptDue`로 양보하고, 여기서 세션 플래그를 세우면 같은 세션의 나머지 넛지도 물러난다 -
 * 구독 순서와 무관하게 이 세션의 슬롯은 VOC가 가진다. 기록을 모달을 여는 순간으로 미루지 않는
 * 이유: 조건을 못 채우고 떠나는 짧은 방문이 이어지면 VOC가 계속 "물어볼 때"로 남아, 양보하는 가입
 * 넛지와 코치 마크가 영영 못 뜬다. 조건이 채워지기 전에 이 호스트가 사라지면 그 번의 모달은
 * 건너뛴다. 그 방문은 간격을 다시 시작하고 그 세션의 슬롯을 쓰지만, 물은 횟수에는 들지 않는다 -
 * 횟수는 모달이 열릴 때(`markVocShown`) 센다.
 * 모든 E2E 스펙이 세션 플래그를 미리 심으므로 이 호스트가 그것을 존중해야 기존 클릭이 모달에
 * 막히지 않는다.
 */
export function VocPromptHost({ trigger }: VocPromptHostProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (isVocPromptRetired()) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let engaged = false;
        let delayElapsed = false;
        let typingRetriesLeft = VOC_PROMPT_TYPING_RETRIES;
        const openUnlessTyping = () => {
            if (!isTyping()) {
                markVocShown();
                setOpen(true);
                return;
            }
            // 미룰 횟수를 다 썼다 - 계속 입력 중인 방문자를 방해하지 않고 이 세션에는 열지 않는다.
            if (typingRetriesLeft === 0) return;
            typingRetriesLeft -= 1;
            timer = setTimeout(openUnlessTyping, VOC_PROMPT_TYPING_RETRY_MS);
        };
        // 신호 전의 입력도 센다 - 방문자가 이미 페이지를 쓰고 있었다는 뜻이다.
        const stopListening = listenForFirstEngagement(() => {
            engaged = true;
            // 지연이 이미 끝났으면 이 입력이 마지막 조건이다 - 입력과 같은 순간에 열지 않는다.
            if (delayElapsed) {
                timer = setTimeout(openUnlessTyping, VOC_PROMPT_SETTLE_MS);
            }
        });
        const unsubscribe = SUBSCRIBE_BY_TRIGGER[trigger](key => {
            // 이용을 세고, 아직 물어볼 때가 아니면 다음 신호를 기다린다.
            if (!recordVocUse(trigger, key)) return;
            // 다른 넛지가 이 세션을 가졌다. 조건은 채워진 채로 남아 다음 세션의 첫 신호에 묻는다.
            if (hasNudgeShownThisSession()) return;
            // 한 번 묻기로 하면 이 마운트에서는 더 세지 않는다.
            unsubscribe();
            // 신호를 받은 즉시 세션을 선점한다. 지연 뒤에 확인하면 그 사이 같은 신호를 받은 다른
            // 넛지(코치 마크 등)가 세션 플래그를 먼저 세워 모달도 넛지도 못 보는 세션이 생긴다.
            // 기록부터 한다. 기록에 실패하면 모달을 열지 않으므로 세션 슬롯도 잡지 않는다 - 다른
            // 넛지가 쓸 수 있다.
            if (!claimVocPrompt()) {
                stopListening();
                return;
            }
            markNudgeShownThisSession();
            timer = setTimeout(() => {
                delayElapsed = true;
                if (engaged) openUnlessTyping();
            }, VOC_PROMPT_DELAY_MS[trigger]);
        });
        return () => {
            unsubscribe();
            stopListening();
            clearTimeout(timer);
        };
    }, [trigger]);

    if (!open) return null;
    return <VocPromptModal trigger={trigger} onClose={() => setOpen(false)} />;
}
