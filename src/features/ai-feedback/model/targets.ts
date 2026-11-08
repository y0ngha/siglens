import type {
    AgentMessageFeedbackContext,
    AgentTranscriptEntry,
    AnalysisFeedbackContext,
} from '@/entities/feedback/types';

/**
 * siglens 분석 결과 하나를 평가할 대상. 위젯이 화면에 보이는 결과 객체를 `snapshot`으로
 * 그대로 넘긴다 - 서버가 크기를 자르므로 클라이언트는 가공하지 않는다.
 */
export interface AnalysisFeedbackTarget {
    readonly surface: 'siglens';
    readonly context: AnalysisFeedbackContext;
    readonly snapshot: unknown;
}

/**
 * 시그렌즈 AI 답변 하나를 평가할 대상. 대화 기록은 누른 순간에만 필요하고 만드는 데 대화 길이만큼
 * 비용이 들어, 렌더마다 만들지 않도록 함수로 받는다.
 */
export interface AgentMessageFeedbackTarget {
    readonly surface: 'siglens_ai';
    readonly context: AgentMessageFeedbackContext;
    readonly getTranscript: () => readonly AgentTranscriptEntry[];
}

export type AiFeedbackTarget =
    | AnalysisFeedbackTarget
    | AgentMessageFeedbackTarget;

const snapshotIds = new WeakMap<object, number>();
let nextSnapshotId = 1;

/**
 * 결과 객체마다 안정적인 번호. `analyzedAt`/`generatedAt` 같은 시각 필드가 없는 위젯도 새 결과가
 * 도착하면(=새 객체) 키가 바뀌게 한다. 같은 객체를 다시 렌더하는 동안은 같은 번호를 돌려준다.
 */
function snapshotIdentity(snapshot: unknown): number | null {
    if (typeof snapshot !== 'object' || snapshot === null) return null;
    const known = snapshotIds.get(snapshot);
    if (known !== undefined) return known;
    const id = nextSnapshotId++;
    snapshotIds.set(snapshot, id);
    return id;
}

/**
 * 평가 상태를 리셋할 기준이 되는 "어느 결과인가" 키. `viewMode`(쉽게 보기/전문가용 전환)는
 * 같은 결과의 다른 표현이라 뺀다 - 넣으면 전환할 때마다 눌러 둔 평가가 사라진다.
 * 챗은 `messageIndex`만으로는 다시 생성한 답과 구분되지 않아 호출부가 `resetKey`(메시지 id)를 준다.
 */
export function feedbackIdentityKey(target: AiFeedbackTarget): string {
    if (target.surface === 'siglens_ai') {
        const { conversationId, messageId, messageIndex } = target.context;
        return JSON.stringify([
            'ai',
            conversationId ?? null,
            messageId ?? null,
            messageIndex,
        ]);
    }
    const { viewMode: _viewMode, ...identity } = target.context;
    return JSON.stringify([
        'siglens',
        identity,
        snapshotIdentity(target.snapshot),
    ]);
}
