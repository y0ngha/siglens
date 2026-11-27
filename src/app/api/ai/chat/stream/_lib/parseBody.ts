import {
    formatAttachedImagesMarker,
    type AgentMessage,
} from '@y0ngha/siglens-core';
import { withAttachedImagesMarker } from '@/entities/chat-conversation/lib/attachedImagesMarker';
import { followUpLine } from '@/app/api/ai/chat/followUps';
import {
    isSendableMessage,
    MESSAGE_MAX_CHARS,
} from '@/features/agent-chat/lib/messageLimits';
import {
    CHAT_IMAGE_ACCEPT_TYPES,
    CHAT_IMAGE_DECODED_MAX_BYTES,
    CHAT_IMAGES_PER_MESSAGE_MAX,
} from '@/shared/config/chatImages';

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
    /**
     * 첨부 이미지의 base64 문자열(디코드하지 않은 채, 디코드 크기는 장당 {@link CHAT_IMAGE_DECODED_MAX_BYTES} 이하).
     * 디코드·정규화는 인증·한도·슬롯·락을 지난 뒤 라우트가 한다 — 여기서는 모양과 크기만 본다. 없으면 빈 배열.
     */
    images: string[];
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
    /** 사용자 메시지에 이미지가 있었다는 사실만 — 이미지 자체는 브라우저 메모리에만 있고 다시 보내지 않는다. */
    imageCount?: number;
}

function isGuestHistoryItem(x: unknown): x is GuestHistoryItem {
    if (typeof x !== 'object' || x === null) return false;
    const role: unknown = Reflect.get(x, 'role');
    const content: unknown = Reflect.get(x, 'content');
    const followUps: unknown = Reflect.get(x, 'followUps');
    const imageCount: unknown = Reflect.get(x, 'imageCount');
    return (
        (role === 'user' || role === 'assistant') &&
        typeof content === 'string' &&
        (followUps === undefined ||
            (Array.isArray(followUps) &&
                followUps.every(item => typeof item === 'string'))) &&
        (imageCount === undefined ||
            (role === 'user' &&
                typeof imageCount === 'number' &&
                Number.isInteger(imageCount) &&
                imageCount > 0 &&
                imageCount <= CHAT_IMAGES_PER_MESSAGE_MAX))
    );
}

function parseGuestHistory(raw: unknown): AgentMessage[] | null {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) return null;
    const recent = raw.slice(-GUEST_HISTORY_MAX_MESSAGES);
    if (!recent.every(isGuestHistoryItem)) return null;
    return recent
        .map(m => ({ ...m, content: m.content.trim() }))
        .filter(m => m.content !== '' || m.imageCount !== undefined)
        .map(m => {
            // 회원 기록(DB 원문)과 같은 모양이 되도록 답변에만 마커 줄을 되붙인다. 본문을
            // 먼저 줄 길이만큼 덜 자르고 줄을 붙인다 — 그래야 상한에 걸려도 마커 줄은
            // 잘리지 않는다(줄 길이는 `followUpLine`이 묶어 둔다).
            if (m.imageCount !== undefined) {
                // 회원 기록(`toAgentHistory`)과 같은 모양: 본문 끝에 첨부 표식 줄. 표식 줄이
                // 잘리지 않도록 본문을 먼저 줄인다.
                const marker = formatAttachedImagesMarker(m.imageCount);
                const text = m.content.slice(
                    0,
                    GUEST_HISTORY_MESSAGE_MAX_CHARS - marker.length - 1
                );
                return {
                    role: m.role,
                    content: withAttachedImagesMarker(text, m.imageCount),
                };
            }
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

/** 표준 base64 한 덩어리 — 줄바꿈·공백·`data:` 접두사를 받지 않는다. */
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/** base64 문자열이 디코드되면 몇 바이트인지(디코드하지 않고 센다). 형식이 틀리면 `null`. */
function decodedByteLength(data: string): number | null {
    if (data.length === 0 || data.length % 4 !== 0 || !BASE64_RE.test(data))
        return null;
    return (data.length / 4) * 3 - base64PaddingLength(data);
}

function base64PaddingLength(data: string): number {
    if (data.endsWith('==')) return 2;
    return data.endsWith('=') ? 1 : 0;
}

/**
 * `images` 필드 검증. 없으면 `[]`, 모양이 틀리거나 4장 초과·장당 디코드 10MB 초과면 `null`.
 * `mediaType`은 클라이언트의 주장일 뿐이라 허용 목록 확인만 하고, 실제 포맷은 서버 정규화가 판정한다.
 * 디코드하지 않는다 — 인증·한도 검사 전에 요청마다 최대 40MB 버퍼를 만들지 않도록 문자열 그대로 넘기고, 디코드는
 * 슬롯·락을 잡은 뒤 `normalizeBodyImages`가 한다.
 */
function parseImages(raw: unknown): string[] | null {
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || raw.length > CHAT_IMAGES_PER_MESSAGE_MAX)
        return null;
    const accepted = raw.map((item: unknown): string | null => {
        if (typeof item !== 'object' || item === null) return null;
        const mediaType: unknown = Reflect.get(item, 'mediaType');
        const data: unknown = Reflect.get(item, 'data');
        if (
            typeof mediaType !== 'string' ||
            !CHAT_IMAGE_ACCEPT_TYPES.some(type => type === mediaType) ||
            typeof data !== 'string'
        )
            return null;
        const size = decodedByteLength(data);
        return size === null || size > CHAT_IMAGE_DECODED_MAX_BYTES
            ? null
            : data;
    });
    return accepted.every(data => data !== null) ? accepted : null;
}

type Action = ParsedBody['action'];

/**
 * `action` 필드의 허용값 — 목록 밖 값은 기본값으로 덮지 않고 거절한다.
 * `satisfies Record<Action, true>`라 유니언에 멤버가 늘면 여기서 컴파일 에러가 난다.
 */
const ACTIONS = {
    send: true,
    regenerate: true,
    edit: true,
} as const satisfies Record<Action, true>;

function isAction(x: unknown): x is Action {
    return typeof x === 'string' && Object.hasOwn(ACTIONS, x);
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
    const images = parseImages(Reflect.get(raw, 'images'));
    if (images === null) return null;
    // 멤버 재생성은 DB에 저장된 이미지를 다시 읽고, 게스트 재생성은 `send`로 나간다 — 클라이언트가 재생성에 이미지를
    // 싣는 경로는 없다. 싣고 오면 디코드·sharp만 돌고 버려지므로 거절한다.
    if (action === 'regenerate' && images.length > 0) return null;
    // 이미지가 1장 이상이면 글이 비어도 된다(길이 상한은 그대로).
    const sendable =
        images.length > 0
            ? message.length <= MESSAGE_MAX_CHARS
            : isSendableMessage(message);
    if (action !== 'regenerate' && !sendable) return null;
    const history = parseGuestHistory(Reflect.get(raw, 'history'));
    if (history === null) return null;
    const base: BaseBody = {
        conversationId:
            typeof rawConversationId === 'string' ? rawConversationId : null,
        message,
        history,
        images,
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
