import { splitAgentFollowUps, type AgentMessage } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';

/** `deriveTitle`이 첫 메시지에서 잘라 내는 제목의 최대 코드 포인트 수 (DB 컬럼 상한은 {@link CONVERSATION_TITLE_COLUMN_MAX}). */
const CONVERSATION_TITLE_MAX = 60;

/**
 * `chat_conversations.title` varchar 길이 상한. 이름 변경 액션의 입력 검증과
 * 저장소의 최종 절단이 같은 값을 쓰게 하는 단일 출처다.
 */
export const CONVERSATION_TITLE_COLUMN_MAX = 120;

/**
 * `listConversationsAction`과 `DrizzleChatConversationRepository.listForUser`의 페이지 크기.
 *
 * 커서 페이징이 없으므로 이 값은 가장 큰 티어의 대화 수 상한(현재 pro = 300) 이상이어야 한다.
 * 작으면 pro 회원의 오래된 대화가 목록에서 조용히 사라진다. 티어 상한이 300을 넘으면 이 값을
 * 맞춰 올리거나, 단일 LIMIT이 한계에 닿은 시점에 커서 페이징을 도입한다.
 */
export const CONVERSATION_LIST_LIMIT = 300;

type ChatMessageRole = 'user' | 'assistant' | 'tool';
type ChatMessageStatus = 'complete' | 'aborted' | 'error' | 'superseded';

/** 저장된 SIGLENS AI 대화 행. */
export interface ChatConversationRecord {
    id: string;
    userId: string;
    title: string;
    locale: Locale;
    modelId: string;
    messageCount: number;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

/** 저장된 대화 메시지 행. */
export interface ChatMessageRecord {
    id: string;
    conversationId: string;
    seq: number;
    role: ChatMessageRole;
    content: string;
    toolCalls: AgentMessage['toolCalls'] | null;
    toolCallId: string | null;
    toolName: string | null;
    modelId: string | null;
    usage: Record<string, unknown> | null;
    status: ChatMessageStatus;
    createdAt: Date;
}

/** 추가할 메시지 한 건. `seq`는 저장소가 매긴다. */
export interface NewChatMessage {
    role: ChatMessageRole;
    content: string;
    toolCalls?: AgentMessage['toolCalls'];
    toolCallId?: string;
    toolName?: string;
    modelId?: string;
    usage?: Record<string, unknown>;
    status?: ChatMessageStatus;
}

/** 클라이언트용 메시지 뷰 — `usage` 같은 서버 내부 필드가 없다. */
export interface ChatMessageView {
    id: string;
    seq: number;
    role: ChatMessageRole;
    content: string;
    toolCalls: AgentMessage['toolCalls'] | null;
    toolName: string | null;
    status: ChatMessageStatus;
    createdAt: string;
    /**
     * 답변 끝줄의 후속 질문 칩 항목. 있으면 `content`에서는 그 마커 줄이 빠져 있다 —
     * 나누기는 서버(`toMessageView`)에서 한다. 클라이언트가 core를 싣지 않게 하려는
     * 것이다(core는 CommonJS 한 덩어리라 함수 하나에 번들 전체가 따라온다).
     */
    followUps?: string[];
}

/**
 * 첫 메시지가 공백뿐이라 제목이 비었을 때 보여 줄 기본 제목. 대화 자신의 `locale`로 고른다 —
 * 감사용 `analysis_history.locale`과 달리 화면에 그대로 보이는 문구다.
 */
const DEFAULT_TITLE_BY_LOCALE: Record<Locale, string> = {
    ko: '새 대화',
    en: 'New chat',
    ja: '新しいチャット',
    zh: '新对话',
};

/**
 * 첫 사용자 메시지에서 대화 제목을 만든다: 첫 줄을 {@link CONVERSATION_TITLE_MAX} *코드 포인트*로
 * 자른다(`.length`로 자르면 이모지 서로게이트 쌍이 반쪽으로 잘린다). 분할 전에 `\r`/`\r\n`을
 * `\n`으로 통일해 Windows식 줄바꿈의 `\r`이 남지 않게 한다. 첫 줄이 비면 로케일별 기본 제목을 쓴다.
 */
export function deriveTitle(
    firstMessage: string,
    locale: Locale = 'ko'
): string {
    const line =
        firstMessage.replace(/\r\n?/g, '\n').trim().split('\n')[0] ?? '';
    if (line.length === 0) return DEFAULT_TITLE_BY_LOCALE[locale];
    const codePoints = Array.from(line);
    return codePoints.length > CONVERSATION_TITLE_MAX
        ? `${codePoints.slice(0, CONVERSATION_TITLE_MAX).join('')}…`
        : line;
}

/** 행 → core 대화 기록. regenerate/edit 잔여인 superseded·error 행은 버리고, 부분 답변도 유효한 맥락이므로 `aborted` 행은 남긴다. */
export function toAgentHistory(
    rows: readonly Pick<
        ChatMessageRecord,
        'role' | 'content' | 'toolCalls' | 'toolCallId' | 'toolName' | 'status'
    >[]
): AgentMessage[] {
    return rows
        .filter(r => r.status === 'complete' || r.status === 'aborted')
        .map(r => ({
            role: r.role,
            content: r.content,
            ...(r.toolCalls && r.toolCalls.length > 0
                ? { toolCalls: r.toolCalls }
                : {}),
            ...(r.toolCallId ? { toolCallId: r.toolCallId } : {}),
            ...(r.toolName ? { toolName: r.toolName } : {}),
        }));
}

/**
 * 레코드 → 클라이언트 뷰. 서버 내부 필드(`usage`, `toolCallId`, `modelId`)를 뺀다.
 * assistant 행의 후속 질문 마커 줄은 여기(서버)에서 `followUps`로 떼어 낸다. 저장된
 * `content`에는 마커가 남는다 — 모델이 히스토리로 다시 읽기 때문이다.
 */
export function toMessageView(r: ChatMessageRecord): ChatMessageView {
    const { body, followUps } =
        r.role === 'assistant'
            ? splitAgentFollowUps(r.content)
            : { body: r.content, followUps: [] };
    return {
        id: r.id,
        seq: r.seq,
        role: r.role,
        content: body,
        toolCalls: r.toolCalls,
        toolName: r.toolName,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        // 빈 배열은 싣지 않는다 — RSC 페이로드에 메시지마다 `[]`가 붙을 이유가 없다.
        ...(followUps.length > 0 ? { followUps } : {}),
    };
}

/** 사이드바 목록의 대화 한 줄. */
export interface ConversationListItem {
    id: string;
    title: string;
    lastMessageAt: string;
}

/** 대화 상세 화면용 페이로드 — `superseded`가 걸러진 메시지 뷰를 담는다. */
export interface ConversationDetail {
    id: string;
    title: string;
    messages: ChatMessageView[];
}

/** 대화 레코드 → 사이드바 목록 항목(시각은 ISO 문자열로 직렬화). */
export function toConversationListItem(
    r: Pick<ChatConversationRecord, 'id' | 'title' | 'lastMessageAt'>
): ConversationListItem {
    return {
        id: r.id,
        title: r.title,
        lastMessageAt: r.lastMessageAt.toISOString(),
    };
}
