import { SYMBOL_MAX_LENGTH } from '@/shared/db/constants';
import {
    DOWN_COMMENT_MAX_LENGTH,
    FEEDBACK_ANALYSIS_TYPES,
    FEEDBACK_DOWN_REASONS,
    FEEDBACK_SURFACES,
    FEEDBACK_VOTES,
    VOC_COMMENT_MAX_LENGTH,
    VOC_RATING_MAX,
    VOC_RATING_MIN,
    type AgentMessageFeedbackContext,
    type AgentTranscriptEntry,
    type AnalysisFeedbackContext,
    type FeedbackAnalysisType,
    type FeedbackDownReason,
    type FeedbackVote,
    type SubmitAiFeedbackInput,
    type SubmitVocFeedbackInput,
    type UpdateAiFeedbackInput,
    type VocTrigger,
} from '../types';
import {
    CONTEXT_STRING_MAX_LENGTH,
    PAGE_PATH_MAX_LENGTH,
    TRANSCRIPT_MAX_ENTRIES,
    TRANSCRIPT_MAX_TOOLS,
} from './constants';

/**
 * 서버 액션 인자는 클라이언트가 임의로 만들 수 있으므로, 계약 타입의 입력으로
 * 바꾸는 순수 검증기를 둔다. 통과한 값은 **알려진 키만 다시 조립**한 새 객체라
 * 클라이언트가 끼워 넣은 여분의 필드가 DB에 저장되지 않는다. 실패는 `null`.
 */

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOC_TRIGGERS: readonly VocTrigger[] = ['analysis', 'agent_chat'];
const VIEW_MODES = ['plain', 'full'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOneOf<T extends string>(
    list: readonly T[],
    value: unknown
): value is T {
    return (
        typeof value === 'string' && (list as readonly string[]).includes(value)
    );
}

/** 문자열이면 trim 후 길이 검사, 비어 있으면 undefined, 상한 초과·비문자열이면 null(실패). */
function optionalString(
    value: unknown,
    maxLength: number
): string | undefined | null {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return trimmed.length > maxLength ? null : trimmed;
}

/**
 * 페이지 경로를 저장 가능한 형태로 정리한다: 쿼리·해시를 떼고 {@link PAGE_PATH_MAX_LENGTH}자로 자른다.
 * `/`로 시작하는 단일 경로만 받는다(`//host` 형태·절대 URL은 거부) — 쿼리에는 토큰이 실릴 수 있어
 * 저장하지 않는다.
 */
export function sanitizePagePath(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const path = raw.split(/[?#]/, 1)[0] ?? '';
    if (!path.startsWith('/') || path.startsWith('//')) return null;
    return path.slice(0, PAGE_PATH_MAX_LENGTH);
}

export function parseVocInput(raw: unknown): SubmitVocFeedbackInput | null {
    if (!isRecord(raw)) return null;
    if (!isOneOf(FEEDBACK_SURFACES, raw.surface)) return null;
    if (!isOneOf(VOC_TRIGGERS, raw.trigger)) return null;
    const rating = raw.rating;
    if (
        typeof rating !== 'number' ||
        !Number.isInteger(rating) ||
        rating < VOC_RATING_MIN ||
        rating > VOC_RATING_MAX
    ) {
        return null;
    }
    const comment = optionalString(raw.comment, VOC_COMMENT_MAX_LENGTH);
    if (comment === null) return null;
    const pagePath = sanitizePagePath(raw.pagePath);
    if (pagePath === null) return null;
    return {
        surface: raw.surface,
        rating,
        ...(comment !== undefined ? { comment } : {}),
        trigger: raw.trigger,
        pagePath,
    };
}

function parseAnalysisContext(raw: unknown): AnalysisFeedbackContext | null {
    if (!isRecord(raw)) return null;
    if (
        !isOneOf<FeedbackAnalysisType>(
            FEEDBACK_ANALYSIS_TYPES,
            raw.analysisType
        )
    ) {
        return null;
    }
    const strings: Record<string, string | undefined> = {};
    for (const key of [
        'symbol',
        'timeframe',
        'modelId',
        'analyzedAt',
        'generatedAt',
    ] as const) {
        const value = optionalString(
            raw[key],
            // 심볼은 `feedback.symbol` 컬럼 길이에 맞춘다 - 넘으면 insert가 실패한다.
            key === 'symbol' ? SYMBOL_MAX_LENGTH : CONTEXT_STRING_MAX_LENGTH
        );
        if (value === null) return null;
        strings[key] = value;
    }
    if (raw.reasoning !== undefined && typeof raw.reasoning !== 'boolean') {
        return null;
    }
    if (raw.viewMode !== undefined && !isOneOf(VIEW_MODES, raw.viewMode)) {
        return null;
    }

    let extra: AnalysisFeedbackContext['extra'];
    if (raw.extra !== undefined) {
        if (!isRecord(raw.extra)) return null;
        const expirationDate = optionalString(
            raw.extra.expirationDate,
            CONTEXT_STRING_MAX_LENGTH
        );
        const scope = optionalString(
            raw.extra.scope,
            CONTEXT_STRING_MAX_LENGTH
        );
        const category = optionalString(
            raw.extra.category,
            CONTEXT_STRING_MAX_LENGTH
        );
        if (expirationDate === null || scope === null || category === null) {
            return null;
        }
        extra = {
            ...(expirationDate !== undefined ? { expirationDate } : {}),
            ...(scope !== undefined ? { scope } : {}),
            ...(category !== undefined ? { category } : {}),
        };
    }

    return {
        analysisType: raw.analysisType,
        ...(strings.symbol !== undefined ? { symbol: strings.symbol } : {}),
        ...(strings.timeframe !== undefined
            ? { timeframe: strings.timeframe }
            : {}),
        ...(strings.modelId !== undefined ? { modelId: strings.modelId } : {}),
        ...(raw.reasoning !== undefined ? { reasoning: raw.reasoning } : {}),
        ...(strings.analyzedAt !== undefined
            ? { analyzedAt: strings.analyzedAt }
            : {}),
        ...(strings.generatedAt !== undefined
            ? { generatedAt: strings.generatedAt }
            : {}),
        ...(extra !== undefined ? { extra } : {}),
        ...(raw.viewMode !== undefined ? { viewMode: raw.viewMode } : {}),
    };
}

function parseAgentContext(raw: unknown): AgentMessageFeedbackContext | null {
    if (!isRecord(raw)) return null;
    if (
        typeof raw.messageIndex !== 'number' ||
        !Number.isInteger(raw.messageIndex) ||
        raw.messageIndex < 0
    ) {
        return null;
    }
    if (typeof raw.guest !== 'boolean') return null;
    for (const key of ['conversationId', 'messageId'] as const) {
        const value = raw[key];
        if (
            value !== undefined &&
            (typeof value !== 'string' || !UUID_RE.test(value))
        ) {
            return null;
        }
    }
    return {
        ...(raw.conversationId !== undefined
            ? { conversationId: raw.conversationId as string }
            : {}),
        ...(raw.messageId !== undefined
            ? { messageId: raw.messageId as string }
            : {}),
        messageIndex: raw.messageIndex,
        guest: raw.guest,
    };
}

function parseTranscript(raw: unknown): AgentTranscriptEntry[] | null {
    if (!Array.isArray(raw)) return null;
    const entries: AgentTranscriptEntry[] = [];
    // 상한을 넘으면 거부하지 않고 가장 최근 줄만 남긴다(평가한 답변은 대화 끝쪽에 있다).
    for (const item of raw.slice(-TRANSCRIPT_MAX_ENTRIES)) {
        if (!isRecord(item)) return null;
        if (item.role !== 'user' && item.role !== 'assistant') return null;
        if (typeof item.content !== 'string') return null;
        let tools: AgentTranscriptEntry['tools'];
        if (item.tools !== undefined) {
            if (!Array.isArray(item.tools)) return null;
            const parsed: { name: string; summary?: string }[] = [];
            for (const tool of item.tools.slice(0, TRANSCRIPT_MAX_TOOLS)) {
                if (!isRecord(tool) || typeof tool.name !== 'string')
                    return null;
                if (
                    tool.summary !== undefined &&
                    typeof tool.summary !== 'string'
                ) {
                    return null;
                }
                parsed.push({
                    name: tool.name.slice(0, CONTEXT_STRING_MAX_LENGTH),
                    ...(tool.summary !== undefined
                        ? { summary: tool.summary }
                        : {}),
                });
            }
            tools = parsed;
        }
        entries.push({
            role: item.role,
            content: item.content,
            ...(tools !== undefined ? { tools } : {}),
        });
    }
    return entries;
}

/**
 * 👍/👎 제출 입력을 검증한다. siglens 분석의 `snapshot`은 임의 JSON이라 형태를 따지지
 * 않고(크기는 `capSnapshot`이 제한), `undefined`만 거부한다. 챗 `snapshot`은 대화 기록 모양을 강제한다.
 */
export function parseAiFeedbackInput(
    raw: unknown
): SubmitAiFeedbackInput | null {
    if (!isRecord(raw)) return null;
    if (!isOneOf<FeedbackVote>(FEEDBACK_VOTES, raw.vote)) return null;
    const pagePath = sanitizePagePath(raw.pagePath);
    if (pagePath === null) return null;

    if (raw.surface === 'siglens') {
        const context = parseAnalysisContext(raw.context);
        if (context === null || raw.snapshot === undefined) return null;
        return {
            surface: 'siglens',
            vote: raw.vote,
            context,
            snapshot: raw.snapshot,
            pagePath,
        };
    }
    if (raw.surface === 'siglens_ai') {
        const context = parseAgentContext(raw.context);
        const snapshot = parseTranscript(raw.snapshot);
        if (context === null || snapshot === null) return null;
        return {
            surface: 'siglens_ai',
            vote: raw.vote,
            context,
            snapshot,
            pagePath,
        };
    }
    return null;
}

/**
 * 👍/👎 갱신 입력을 검증한다. `vote`·`reasons`·`comment` 중 하나는 있어야 한다.
 * 사유는 중복을 제거하고, 빈 의견은 `''`(= 지우기)로 유지한다.
 */
export function parseUpdateInput(raw: unknown): UpdateAiFeedbackInput | null {
    if (!isRecord(raw)) return null;
    if (typeof raw.id !== 'string' || !UUID_RE.test(raw.id)) return null;

    let vote: FeedbackVote | undefined;
    if (raw.vote !== undefined) {
        if (!isOneOf<FeedbackVote>(FEEDBACK_VOTES, raw.vote)) return null;
        vote = raw.vote;
    }

    let reasons: FeedbackDownReason[] | undefined;
    if (raw.reasons !== undefined) {
        if (
            !Array.isArray(raw.reasons) ||
            raw.reasons.length > FEEDBACK_DOWN_REASONS.length
        ) {
            return null;
        }
        const unique = new Set<FeedbackDownReason>();
        for (const reason of raw.reasons) {
            if (!isOneOf<FeedbackDownReason>(FEEDBACK_DOWN_REASONS, reason)) {
                return null;
            }
            unique.add(reason);
        }
        reasons = [...unique];
    }

    let comment: string | undefined;
    if (raw.comment !== undefined) {
        if (typeof raw.comment !== 'string') return null;
        comment = raw.comment.trim();
        if (comment.length > DOWN_COMMENT_MAX_LENGTH) return null;
    }

    if (vote === undefined && reasons === undefined && comment === undefined) {
        return null;
    }
    return {
        id: raw.id,
        ...(vote !== undefined ? { vote } : {}),
        ...(reasons !== undefined ? { reasons } : {}),
        ...(comment !== undefined ? { comment } : {}),
    };
}
