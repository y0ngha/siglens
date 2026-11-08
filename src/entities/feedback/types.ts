/**
 * 피드백(VOC 별점, AI 응답 👍/👎) 도메인 계약. 클라이언트(`features/ai-feedback`,
 * `features/voc-prompt`)와 서버 액션이 같은 모양을 쓰도록 이 클라이언트 안전 모듈에 둔다.
 * 서버 전용 코드를 import하지 않는다.
 */

/** 피드백이 나온 사이트. siglens.io 본 서비스와 시그렌즈 AI(ai.siglens.io). */
export const FEEDBACK_SURFACES = ['siglens', 'siglens_ai'] as const;
export type FeedbackSurface = (typeof FEEDBACK_SURFACES)[number];

/** AI 응답 평가 방향. */
export const FEEDBACK_VOTES = ['up', 'down'] as const;
export type FeedbackVote = (typeof FEEDBACK_VOTES)[number];

/** 👎 사유 칩. 저장값이라 이름을 바꾸지 않는다(추가만). */
export const FEEDBACK_DOWN_REASONS = [
    'inaccurate',
    'unsupported',
    'off_topic',
    'too_long',
    'other',
] as const;
export type FeedbackDownReason = (typeof FEEDBACK_DOWN_REASONS)[number];

/** `/api/analysis/stream`이 만드는 분석 종류. `target_type` 컬럼에 그대로 저장된다. */
export const FEEDBACK_ANALYSIS_TYPES = [
    'technical',
    'overall',
    'fundamental',
    'financials',
    'news',
    'marketNewsDigest',
    'options',
    'congress',
    'investorFlows',
    'briefing',
    'macroBriefing',
] as const;
export type FeedbackAnalysisType = (typeof FEEDBACK_ANALYSIS_TYPES)[number];

/** 챗 답변 평가의 `target_type` 값. */
export const AGENT_MESSAGE_TARGET_TYPE = 'agent_message';

export const VOC_COMMENT_MAX_LENGTH = 1000;
export const DOWN_COMMENT_MAX_LENGTH = 500;
export const VOC_RATING_MIN = 1;
export const VOC_RATING_MAX = 5;

/** VOC 모달을 띄운 계기. */
export type VocTrigger = 'analysis' | 'agent_chat';

/** siglens 분석 결과 하나를 평가할 때 위젯이 넘기는 식별 맥락. */
export interface AnalysisFeedbackContext {
    readonly analysisType: FeedbackAnalysisType;
    readonly symbol?: string;
    readonly timeframe?: string;
    readonly modelId?: string;
    readonly reasoning?: boolean;
    /** 결과가 들고 있는 분석 시각(ISO). 없으면 생략. */
    readonly analyzedAt?: string;
    /** 브리핑류의 생성 시각(ISO). */
    readonly generatedAt?: string;
    readonly extra?: {
        readonly expirationDate?: string;
        readonly scope?: string;
        readonly category?: string;
    };
    readonly viewMode?: 'plain' | 'full';
}

/** 시그렌즈 AI 대화 기록 한 줄(스냅샷용). */
export interface AgentTranscriptEntry {
    readonly role: 'user' | 'assistant';
    readonly content: string;
    /** assistant 턴이 부른 도구 이름(+요약). */
    readonly tools?: readonly {
        readonly name: string;
        readonly summary?: string;
    }[];
}

/** 시그렌즈 AI 답변 하나를 평가할 때의 식별 맥락. */
export interface AgentMessageFeedbackContext {
    /** 회원 대화면 chat_conversations.id. 비회원은 없음. */
    readonly conversationId?: string;
    /** 회원 답변이면 chat_messages.id. 임시(pending) id는 넣지 않는다. */
    readonly messageId?: string;
    /** 대화 안에서 평가한 답변의 위치(0부터). */
    readonly messageIndex: number;
    readonly guest: boolean;
}

/** `submitAiFeedbackAction` 입력. 클라이언트가 보내는 값이라 서버가 다시 검증한다. */
export type SubmitAiFeedbackInput =
    | {
          readonly surface: 'siglens';
          readonly vote: FeedbackVote;
          readonly context: AnalysisFeedbackContext;
          /** 화면에 보인 분석 결과 객체. */
          readonly snapshot: unknown;
          readonly pagePath: string;
      }
    | {
          readonly surface: 'siglens_ai';
          readonly vote: FeedbackVote;
          readonly context: AgentMessageFeedbackContext;
          /** 평가한 답변까지의 대화 기록. */
          readonly snapshot: readonly AgentTranscriptEntry[];
          readonly pagePath: string;
      };

/** `updateAiFeedbackAction` 입력. 같은 응답에서 방향을 바꾸거나 👎 사유를 덧붙인다. */
export interface UpdateAiFeedbackInput {
    readonly id: string;
    readonly vote?: FeedbackVote;
    readonly reasons?: readonly FeedbackDownReason[];
    readonly comment?: string;
}

/** `submitVocFeedbackAction` 입력. */
export interface SubmitVocFeedbackInput {
    readonly surface: FeedbackSurface;
    readonly rating: number;
    readonly comment?: string;
    readonly trigger: VocTrigger;
    readonly pagePath: string;
}

export type FeedbackErrorCode =
    | 'invalid_input'
    | 'rate_limited'
    | 'not_found'
    | 'submission_failed';

export type SubmitAiFeedbackResult =
    | { readonly ok: true; readonly id: string }
    | { readonly ok: false; readonly code: FeedbackErrorCode };

export type FeedbackActionResult =
    | { readonly ok: true }
    | { readonly ok: false; readonly code: FeedbackErrorCode };
