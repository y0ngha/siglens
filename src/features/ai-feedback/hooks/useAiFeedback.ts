'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { submitAiFeedbackAction } from '@/entities/feedback/actions/submitAiFeedbackAction';
import { updateAiFeedbackAction } from '@/entities/feedback/actions/updateAiFeedbackAction';
import type {
    FeedbackDownReason,
    FeedbackVote,
    SubmitAiFeedbackInput,
    UpdateAiFeedbackInput,
} from '@/entities/feedback/types';
import { useOptionalToast } from '@/shared/ui/ToastProvider';
import type { AiFeedbackTarget } from '../model/targets';

export interface DownDetail {
    readonly reasons: readonly FeedbackDownReason[];
    readonly comment: string;
}

export interface UseAiFeedbackResult {
    /** 지금 화면에 반영된(낙관적) 평가. 아직 안 눌렀으면 null. */
    readonly vote: FeedbackVote | null;
    readonly popoverOpen: boolean;
    /** 사유 전송 요청이 진행 중인가. */
    readonly detailPending: boolean;
    /** 서버에 저장됐다는 확인을 보여 줄 때 true. */
    readonly thanks: boolean;
    readonly pick: (next: FeedbackVote) => void;
    readonly closePopover: () => void;
    readonly sendDetail: (detail: DownDetail) => Promise<void>;
}

function buildSubmitInput(
    target: AiFeedbackTarget,
    vote: FeedbackVote
): SubmitAiFeedbackInput {
    // 서버 경로는 쿼리를 제외한 경로만 받는다.
    const pagePath = window.location.pathname;
    if (target.surface === 'siglens_ai') {
        return {
            surface: 'siglens_ai',
            vote,
            context: target.context,
            snapshot: target.getTranscript(),
            pagePath,
        };
    }
    return {
        surface: 'siglens',
        vote,
        context: target.context,
        snapshot: target.snapshot,
        pagePath,
    };
}

/**
 * AI 응답 한 건의 👍/👎 상태와 서버 호출. 눌린 즉시 화면을 바꾸고(낙관적), 저장이 실패하면
 * 직전 상태로 되돌리며 토스트로 알린다. 같은 응답에서 방향을 바꾸면 새 행을 만들지 않고 처음
 * 응답이 돌려준 id의 행을 갱신한다 - 처음 응답이 아직 오지 않았어도 id를 기다렸다가 갱신한다.
 *
 * 결과가 바뀌면 호출부가 `key`로 이 훅을 쓰는 컴포넌트를 다시 마운트해 상태를 비운다.
 */
export function useAiFeedback(target: AiFeedbackTarget): UseAiFeedbackResult {
    const t = useTranslations('features.ai-feedback');
    const toast = useOptionalToast();
    const [vote, setVote] = useState<FeedbackVote | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [detailPending, setDetailPending] = useState(false);
    const [thanks, setThanks] = useState(false);
    // 첫 제출의 결과(행 id). 이후 갱신이 같은 행을 가리키도록 약속(Promise)째 들고 있는다.
    const idRef = useRef<Promise<string | null> | null>(null);
    // 선택마다 올리는 순번. 실패 시 되돌림이 가장 최근 선택에서만 일어나게 한다.
    const seqRef = useRef(0);
    // 서버가 마지막으로 확인한 평가. 실패하면 직전 낙관적 값이 아니라 이 값으로 되돌린다.
    const confirmedRef = useRef<FeedbackVote | null>(null);

    const notifyFailure = (): void => {
        toast?.showToast({ message: t('AiFeedbackButtons.failed') });
    };

    const create = async (next: FeedbackVote): Promise<string | null> => {
        try {
            const result = await submitAiFeedbackAction(
                buildSubmitInput(target, next)
            );
            return result.ok ? result.id : null;
        } catch {
            return null;
        }
    };

    const update = async (
        id: string,
        patch: Omit<UpdateAiFeedbackInput, 'id'>
    ): Promise<boolean> => {
        try {
            const result = await updateAiFeedbackAction({ id, ...patch });
            return result.ok;
        } catch {
            return false;
        }
    };

    const pick = (next: FeedbackVote): void => {
        if (next === vote) {
            // 같은 👎를 다시 누르면 사유를 아직 안 보냈을 때만 입력창을 다시 연다.
            if (next === 'down' && !thanks) setPopoverOpen(true);
            return;
        }
        const seq = ++seqRef.current;
        setVote(next);
        setThanks(false);
        setPopoverOpen(next === 'down');

        // 더 새로운 선택이 이미 있으면 그 선택이 자기 결과로 화면을 정하므로 건드리지 않는다.
        const isLatest = (): boolean => seq === seqRef.current;
        const rollback = (): void => {
            if (!isLatest()) return;
            setVote(confirmedRef.current);
            setPopoverOpen(false);
            notifyFailure();
        };
        const confirm = (): void => {
            confirmedRef.current = next;
            if (next === 'up' && isLatest()) setThanks(true);
        };

        if (idRef.current === null) {
            const created = create(next);
            idRef.current = created;
            void created.then(id => {
                if (id === null) {
                    // 다음 시도가 새로 만들도록 비운다.
                    if (idRef.current === created) idRef.current = null;
                    rollback();
                } else confirm();
            });
            return;
        }
        void idRef.current.then(async id => {
            // 행이 만들어지지 않았으면 갱신할 대상이 없다. 최신 선택만 되돌리고 알린다.
            if (id === null) {
                rollback();
                return;
            }
            if (await update(id, { vote: next })) confirm();
            else rollback();
        });
    };

    const sendDetail = async ({
        reasons,
        comment,
    }: DownDetail): Promise<void> => {
        if (idRef.current === null) return;
        setDetailPending(true);
        const id = await idRef.current;
        const trimmed = comment.trim();
        const ok =
            id !== null &&
            (await update(id, {
                reasons,
                ...(trimmed === '' ? {} : { comment: trimmed }),
            }));
        setDetailPending(false);
        if (ok) {
            setPopoverOpen(false);
            setThanks(true);
        } else notifyFailure();
    };

    return {
        vote,
        popoverOpen,
        detailPending,
        thanks,
        pick,
        closePopover: () => setPopoverOpen(false),
        sendDetail,
    };
}
