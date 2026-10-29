import type { AgentMessage } from '@y0ngha/siglens-core';
import { followUpLine } from '@/app/api/ai/chat/followUps';

/** 한 번에 받는 사용자 메시지의 글자 수 상한 — 이를 넘으면 `invalid_body`. */
export const MESSAGE_MAX_CHARS = 4_000;

/**
 * A guest's transcript lives only in the browser, so the client sends it with
 * every turn. It is the caller's own text, so the only thing to guard is size:
 * the newest messages are kept and each is clipped (core's history window then
 * budgets tokens as it does for members). Only plain user/assistant text is
 * accepted — tool rows and tool calls never cross this boundary.
 */
const GUEST_HISTORY_MAX_MESSAGES = 20;
export const GUEST_HISTORY_MESSAGE_MAX_CHARS = 8_000;

interface BaseBody {
    conversationId: string | null;
    message: string;
    /** Guests only — ignored for members. The prior turns the browser still holds (nothing is stored for them). */
    history: AgentMessage[];
}

/**
 * 검증을 통과한 요청 본문. `edit`만 `editSeq`를 싣는 판별 유니언이라 소비자가
 * 비-null 단언 없이 좁힌다.
 */
export type ParsedBody =
    | (BaseBody & { action: 'send' | 'regenerate' })
    | (BaseBody & { action: 'edit'; editSeq: number });

interface GuestHistoryItem {
    role: 'user' | 'assistant';
    content: string;
    /** 답변의 후속 질문 칩 — 클라이언트는 마커 줄이 빠진 본문만 들고 있다(`followUps.ts`). */
    followUps?: string[];
}

function isGuestHistoryItem(x: unknown): x is GuestHistoryItem {
    if (typeof x !== 'object' || x === null) return false;
    const role: unknown = Reflect.get(x, 'role');
    const content: unknown = Reflect.get(x, 'content');
    const followUps: unknown = Reflect.get(x, 'followUps');
    return (
        (role === 'user' || role === 'assistant') &&
        typeof content === 'string' &&
        (followUps === undefined ||
            (Array.isArray(followUps) &&
                followUps.every(item => typeof item === 'string')))
    );
}

function parseGuestHistory(raw: unknown): AgentMessage[] | null {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) return null;
    const recent = raw.slice(-GUEST_HISTORY_MAX_MESSAGES);
    if (!recent.every(isGuestHistoryItem)) return null;
    return recent
        .map(m => ({ ...m, content: m.content.trim() }))
        .filter(m => m.content !== '')
        .map(m => {
            // 회원 기록(DB 원문)과 같은 모양이 되도록 답변에만 마커 줄을 되붙인다. 본문을
            // 먼저 줄 길이만큼 덜 자르고 줄을 붙인다 — 그래야 상한에 걸려도 마커 줄은
            // 잘리지 않는다(줄 길이는 `followUpLine`이 묶어 둔다).
            const line =
                m.role === 'assistant' && m.followUps
                    ? followUpLine(m.followUps)
                    : '';
            return {
                role: m.role,
                content:
                    m.content.slice(
                        0,
                        GUEST_HISTORY_MESSAGE_MAX_CHARS - line.length
                    ) + line,
            };
        });
}

type Action = ParsedBody['action'];

/** `action` 필드의 허용값 — 목록 밖 값은 기본값으로 덮지 않고 거절한다. */
const ACTIONS: readonly Action[] = ['send', 'regenerate', 'edit'];

function isAction(x: unknown): x is Action {
    return ACTIONS.some(action => action === x);
}

/**
 * `POST /api/ai/chat/stream` 본문 검증. 형식이 어긋나면 `null`(→ 400
 * `invalid_body`). Pilot: 클라이언트가 보낸 `model`/`analysisModel`은 읽지 않고 무시한다.
 */
export function parseBody(raw: unknown): ParsedBody | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const rawAction: unknown = Reflect.get(raw, 'action');
    const rawMessage: unknown = Reflect.get(raw, 'message');
    const rawConversationId: unknown = Reflect.get(raw, 'conversationId');
    // `action` is not part of the pilot's client-visible surface (send/regenerate/edit
    // are internal to the SSE contract); an unrecognized value is a client bug, not a
    // silent default — reject it instead of coercing to `send`.
    if (rawAction !== undefined && !isAction(rawAction)) return null;
    const action: Action = rawAction ?? 'send';
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (
        action !== 'regenerate' &&
        (message.length === 0 || message.length > MESSAGE_MAX_CHARS)
    )
        return null;
    const history = parseGuestHistory(Reflect.get(raw, 'history'));
    if (history === null) return null;
    const base: BaseBody = {
        conversationId:
            typeof rawConversationId === 'string' ? rawConversationId : null,
        message,
        history,
    };
    if (action !== 'edit') return { ...base, action };
    // editSeq must be a positive integer — 0/negative would delete the whole
    // transcript in `deleteFromSeq` (`seq >= 0` matches every row).
    const editSeq: unknown = Reflect.get(raw, 'editSeq');
    if (
        typeof editSeq !== 'number' ||
        !Number.isInteger(editSeq) ||
        editSeq <= 0
    )
        return null;
    return { ...base, action, editSeq };
}
