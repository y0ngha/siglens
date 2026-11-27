'use client';

/**
 * 시그렌즈 AI가 제안한 가격대 알림 카드. 도구(`propose_price_alert`)는 아무것도 만들지 않는다 — 카드가 정확한 가격대와
 * 확인 규칙을 보여 주고, 사용자가 "알림 만들기"를 눌러야 서버 액션이 알림을 만든다.
 */
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactNode } from 'react';
import type { ChatPriceAlertProposalBlock } from '@/entities/chat-conversation/types';
import { PRICE_ALERT_MAX_ACTIVE } from '@/entities/mail-alert/lib/priceAlertConstants';
import type {
    PriceAlertOwnerKind,
    PriceAlertStoredTerms,
    PriceAlertConfirmState,
    PriceAlertCreateResult,
    PriceAlertProposalState,
} from '@/entities/mail-alert/model';
import {
    useCreatePriceAlert,
    usePriceAlertCodeFlow,
    usePriceAlertProposalState,
} from '@/features/mail-alert/hooks/usePriceAlertProposal';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { PriceAlertSummary } from './PriceAlertSummary';

/** 이메일·코드 단계는 코드가 필요한 사람이 만들기를 누를 때만 내려받는다. */
const PriceAlertGuestForm = dynamic(
    () =>
        import('@/features/mail-alert/ui/PriceAlertGuestForm').then(
            mod => mod.PriceAlertGuestForm
        ),
    { ssr: false }
);

const LINK_CLASS =
    'text-primary-400 underline underline-offset-2 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** 카드가 끝난 상태로 보여 주는 결과. 이 상태에서는 버튼이 사라지고 문장만 남는다. */
type Outcome =
    | {
          readonly kind: 'created';
          readonly maskedEmail: string;
          readonly owner: PriceAlertOwnerKind;
          readonly stored: PriceAlertStoredTerms;
      }
    | {
          readonly kind:
              | 'exists'
              | 'already_met'
              | 'limit_reached'
              | 'proposal_expired'
              | 'unavailable';
      };

/** 서버가 돌려준 상태·결과를 카드의 끝난 상태로 옮긴다. 아직 만들 수 있거나 코드 확인이 남았으면 `null`. */
function outcomeOf(
    result:
        | PriceAlertProposalState
        | PriceAlertCreateResult
        | PriceAlertConfirmState
        | undefined
): Outcome | null {
    if (result === undefined) return null;
    switch (result.status) {
        case 'created':
            return {
                kind: 'created',
                maskedEmail: result.maskedEmail,
                owner: result.owner,
                stored: result.stored,
            };
        case 'exists':
        case 'already_met':
        case 'limit_reached':
        case 'proposal_expired':
        case 'unavailable':
            return { kind: result.status };
        // 제안 뒤 세션이 마감됐는데 시세를 다시 읽지 못했다 — 다시 요청하면 풀리므로 만료와 같은 안내다.
        case 'proposal_stale':
            return { kind: 'proposal_expired' };
        // 서명이 틀리거나 다른 사람의 제안이라 이 카드로는 누구도 만들 수 없다. 에이전트에게 다시 부탁하면 지금 브라우저에 묶인 새 제안이 나오므로 만료와 같은 안내가 맞다.
        case 'invalid':
            return { kind: 'proposal_expired' };
        default:
            return null;
    }
}

interface PriceAlertProposalCardProps {
    readonly block: ChatPriceAlertProposalBlock;
    /** 메인 사이트 주소 — 방침과 알림 메일 설정은 ai 호스트에 없다. */
    readonly siteUrl: string;
    /** 로케일 접두사(`/en` 등, 기본 로케일은 빈 문자열). */
    readonly localePrefix: string;
}

export function PriceAlertProposalCard({
    block,
    siteUrl,
    localePrefix,
}: PriceAlertProposalCardProps) {
    const t = useTranslations('widgets.agent-chat');
    const tMail = useTranslations('features.mail-alert');
    const titleId = useId();
    const sectionRef = useRef<HTMLElement>(null);
    const { proposal, token } = block;
    const stateQuery = usePriceAlertProposalState(proposal.proposalId, token);
    const create = useCreatePriceAlert();
    const codeFlow = usePriceAlertCodeFlow();
    const [dismissed, setDismissed] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const manageHref = `${siteUrl}${localePrefix}/email-report/alerts`;
    const privacyHref = `${siteUrl}${localePrefix}/privacy`;

    const outcomeText = (outcome: Outcome): ReactNode => {
        switch (outcome.kind) {
            case 'created':
                // 회원은 알림 메일 설정 화면이 알아본다. 비회원의 쿠키는 ai 호스트에만 있어 메일 속 링크로 관리한다.
                return outcome.owner === 'member' ? (
                    <>
                        {t('PriceAlertCard.created', {
                            email: outcome.maskedEmail,
                        })}{' '}
                        <a
                            href={manageHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={LINK_CLASS}
                        >
                            {tMail('manage')}
                        </a>
                    </>
                ) : (
                    t('PriceAlertCard.createdGuest', {
                        email: outcome.maskedEmail,
                    })
                );
            case 'already_met':
                return t('PriceAlertCard.alreadyMet');
            case 'exists':
                return t('PriceAlertCard.exists');
            case 'limit_reached':
                return t('PriceAlertCard.limit', {
                    max: PRICE_ALERT_MAX_ACTIVE,
                });
            case 'proposal_expired':
                return t('PriceAlertCard.expired');
            case 'unavailable':
                return t('PriceAlertCard.unavailable');
        }
    };

    const dismiss = () => {
        setDismissed(true);
        // 눌린 버튼이 사라지므로 포커스를 카드 자체에 둔다(AX-6) — 카드는 닫은 뒤에도 안내 한 줄로 남는다.
        sectionRef.current?.focus();
    };

    const queryOutcome = stateQuery.isError
        ? ({ kind: 'unavailable' } as const)
        : outcomeOf(stateQuery.data);
    const createOutcome = outcomeOf(create.data);
    // 비회원이 코드를 확인해 만든 결과도 같은 자리에서 읽는다 — 요약이 저장된 값으로 바뀌어야 한다.
    const confirmOutcome = outcomeOf(codeFlow.confirmState);
    const outcome = createOutcome ?? confirmOutcome ?? queryOutcome;
    const needsCode =
        create.data?.status === 'needs_code' ||
        (stateQuery.data?.status === 'ready' &&
            stateQuery.data.mode === 'new' &&
            showForm);
    const accountEmail =
        stateQuery.data?.status === 'ready' && stateQuery.data.mode === 'new'
            ? stateQuery.data.accountEmail
            : null;
    const transientError =
        create.data?.status === 'rate_limited' ? tMail('errRateLimited') : null;
    const canCreate = stateQuery.data?.status === 'ready';

    const onCreate = () => {
        if (create.isPending) return;
        if (
            stateQuery.data?.status === 'ready' &&
            stateQuery.data.mode === 'new'
        ) {
            setShowForm(true);
            return;
        }
        create.mutate(token);
    };

    const renderActions = (): ReactNode => {
        if (outcome !== null) return null;
        if (needsCode) {
            return (
                <PriceAlertGuestForm
                    token={token}
                    accountEmail={accountEmail}
                    privacyHref={privacyHref}
                    flow={codeFlow}
                />
            );
        }
        return (
            <div className="flex min-h-11 flex-wrap items-center gap-2">
                {canCreate ? (
                    <>
                        <button
                            type="button"
                            aria-disabled={create.isPending}
                            onClick={onCreate}
                            className={cn(BUTTON_PRIMARY, 'h-11 px-4 text-sm')}
                        >
                            {t('PriceAlertCard.create')}
                        </button>
                        <button
                            type="button"
                            onClick={dismiss}
                            className={cn(
                                BUTTON_GHOST,
                                'min-h-11 px-3 text-sm'
                            )}
                        >
                            {t('PriceAlertCard.dismiss')}
                        </button>
                    </>
                ) : null}
            </div>
        );
    };

    return (
        <section
            ref={sectionRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            className={cn(
                SURFACE_CARD,
                'mt-4 flex flex-col gap-3 p-4 text-sm leading-relaxed text-secondary-200 focus-visible:outline-none'
            )}
        >
            <h3
                id={titleId}
                className="text-sm font-semibold text-secondary-50"
            >
                {t('PriceAlertCard.title')}
            </h3>
            {dismissed ? (
                <p role="status" className="text-secondary-400">
                    {t('PriceAlertCard.dismissed')}
                </p>
            ) : (
                <>
                    <PriceAlertSummary
                        block={block}
                        stored={
                            outcome?.kind === 'created'
                                ? outcome.stored
                                : undefined
                        }
                    />
                    <div aria-live="polite" className="space-y-2 empty:hidden">
                        {outcome === null ? null : (
                            <p className="text-secondary-100">
                                {outcomeText(outcome)}
                            </p>
                        )}
                        {transientError === null ? null : (
                            <p className="text-ui-danger-text">
                                {transientError}
                            </p>
                        )}
                    </div>
                    {renderActions()}
                </>
            )}
        </section>
    );
}
