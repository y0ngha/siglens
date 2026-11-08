import type {
    FeedbackDownReason,
    FeedbackSurface,
    FeedbackVote,
} from '../types';
import type { Locale } from '@/shared/i18n/locales';

export type FeedbackKind = 'voc' | 'ai_response';

/** `feedback` 행 INSERT 입력. 비회원 식별자(쿠키·IP 해시)는 받지 않는다. */
export interface CreateFeedbackRecord {
    kind: FeedbackKind;
    surface: FeedbackSurface;
    rating: number | null;
    vote: FeedbackVote | null;
    reasons: readonly FeedbackDownReason[] | null;
    comment: string | null;
    targetType: string | null;
    symbol: string | null;
    context: Record<string, unknown>;
    snapshot: unknown;
    userId: string | null;
    conversationId: string | null;
    pagePath: string | null;
    locale: Locale;
}

/** 👍/👎 행 갱신 패치. 생략한 필드는 건드리지 않고, `null`은 지운다. */
export interface AiFeedbackPatch {
    vote?: FeedbackVote;
    reasons?: readonly FeedbackDownReason[] | null;
    comment?: string | null;
}

/** 일일 요약이 읽는 행. 스냅샷 같은 무거운 컬럼은 읽지 않는다. */
export interface FeedbackDigestRow {
    surface: string;
    vote: string | null;
    reasons: unknown;
    comment: string | null;
    targetType: string | null;
    symbol: string | null;
    createdAt: Date;
}

/** 피드백 저장소 포트. 액션과 크론이 DB 구현 대신 이 인터페이스에 의존한다. */
export interface FeedbackRepository {
    /** 행을 만들고 id를 돌려준다. */
    create(record: CreateFeedbackRecord): Promise<string>;
    /**
     * `kind='ai_response'` 행 중 `ownerUserId`가 남긴 행만 갱신한다(회원이면 그 user_id, 비회원이면
     * user_id가 빈 행). 갱신된 행이 있으면 true.
     */
    updateAiFeedback(
        id: string,
        patch: AiFeedbackPatch,
        ownerUserId: string | null
    ): Promise<boolean>;
    /** `since` 이후 생성된 👍/👎 행(최신순). */
    listAiFeedbackSince(since: Date): Promise<FeedbackDigestRow[]>;
    /** `before`보다 오래된 행을 모두 삭제하고 삭제한 수를 돌려준다. */
    deleteOlderThan(before: Date): Promise<number>;
}
