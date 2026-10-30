'use client';

/**
 * 스트림 오류 코드 → 배너 문구·재시도 가능 여부·로그인 권유 여부를 정하는 훅.
 */
import { useTranslations } from 'next-intl';
import type { AgentClientErrorCode } from '@/features/agent-chat/lib/errorCodes';
import { AGENT_ERROR_RETRYABLE } from '../utils/errorCopy';
import { GUEST_TURNS_PER_DAY } from '../utils/guestTurnLimit';

interface AgentErrorCopy {
    /** 배너 문구. 오류가 없으면 null. */
    message: string | null;
    /** "다시 시도" 버튼을 띄울지. */
    retryable: boolean;
    /** 횟수를 다 쓴 비회원 — 길은 재시도가 아니라 로그인 하나다. */
    offerLogin: boolean;
}

/**
 * `POST /api/ai/chat/stream`이 낼 수 있는 모든 코드의 문구 — HTTP 단계(`invalid_body`…`disabled`)와
 * 턴 단계(SSE `error` 프레임). `Record<AgentClientErrorCode, string>`(모든 키 필수)라 새 코드는
 * 조용한 폴백이 아니라 `tsc` 실패로 드러난다. 항목마다 이 파일 안의 실제 `t()` 호출이어야
 * 추출기가 찾는다(`ChatShell.test.tsx`의 코드별 검사).
 */
export function useAgentErrorCopy(
    error: string | null,
    signedIn: boolean
): AgentErrorCopy {
    const t = useTranslations('widgets.agent-chat');
    const messageByCode: Record<AgentClientErrorCode, string> = {
        invalid_body: t('ChatShell.errorInvalidBody'),
        unauthenticated: t('ChatShell.errorUnauthenticated'),
        bot: t('ChatShell.errorBot'),
        not_found: t('ChatShell.errorNotFound'),
        conversation_limit: t('ChatShell.errorConversationLimit'),
        conversation_full: t('ChatShell.errorConversationFull'),
        disabled: t('ChatShell.errorDisabled'),
        server_busy: t('ChatShell.errorServerBusy'),
        turn_limit: signedIn
            ? t('ChatShell.errorTurnLimit')
            : t('ChatShell.errorTurnLimitGuest', { n: GUEST_TURNS_PER_DAY }),
        premium_turn_limit: t('ChatShell.errorPremiumTurnLimit'),
        rate_limited: t('ChatShell.errorRateLimited'),
        server_error: t('ChatShell.errorServerError'),
        deadline: t('ChatShell.errorDeadline'),
        aborted: t('ChatShell.errorAborted'),
    };
    const code = error as AgentClientErrorCode | null;
    return {
        message: code
            ? (messageByCode[code] ?? t('ChatShell.errorGeneric'))
            : null,
        retryable: code ? (AGENT_ERROR_RETRYABLE[code] ?? true) : false,
        offerLogin: !signedIn && code === 'turn_limit',
    };
}
