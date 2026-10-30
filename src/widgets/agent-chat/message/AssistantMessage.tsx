'use client';

/**
 * 답 한 턴 — 마크 옆 본문(도구 활동, 마크다운 또는 재작성 초안·생각 중 점), 상태 안내,
 * 관련 종목 링크, 후속 질문 칩.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { RelatedSymbolPage } from '@/features/agent-chat/lib/relatedSymbolPages';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import { AgentMarkdown } from '../AgentMarkdown';
import { SiglensMark } from '../SiglensMark';
import { ToolActivity } from '../ToolActivity';
import { FollowUps } from './FollowUps';
import { RelatedPages } from './RelatedPages';
import { Thinking } from './Thinking';

interface AssistantMessageProps {
    readonly message: AgentUiMessage;
    readonly relatedPages: RelatedSymbolPage[];
    readonly symbolLabels: Readonly<Record<string, string>>;
    /** 후속 질문 칩을 그릴지 — 끝난 마지막 답이고 스트리밍 중이 아닐 때만. */
    readonly showFollowUps: boolean;
    readonly onPickFollowUp: (text: string) => void;
    readonly siteUrl: string;
    readonly localePrefix: string;
    readonly minHeight: number | undefined;
    readonly actions: ReactNode;
}

/**
 * 답은 말풍선 없이 작은 마크 아래 글로 읽힌다. `aria-live`는 지금 바뀌는 턴 하나에만 건다 —
 * 로그 전체에 걸면 토큰마다 대화 전체를 다시 읽는다. 서버가 후속 질문 표시 줄을 이미 떼어 내
 * `content`가 곧 보이는 본문이다.
 */
export function AssistantMessage({
    message: m,
    relatedPages,
    symbolLabels,
    showFollowUps,
    onPickFollowUp,
    siteUrl,
    localePrefix,
    minHeight,
    actions,
}: AssistantMessageProps) {
    const t = useTranslations('widgets.agent-chat');
    const isStreaming = m.status === 'streaming';
    const body = m.content;
    const statusNote: Partial<Record<AgentUiMessage['status'], ReactNode>> = {
        aborted: (
            <p className="mt-2 text-xs text-secondary-400">
                {t('MessageList.96adfe')}
            </p>
        ),
        error: (
            <p className="mt-2 text-xs text-ui-danger-text">
                {t('MessageList.afd172')}
            </p>
        ),
    };
    // 본문 우선순위: 받은 답 → 재작성 중인 초안(흐리게) → 생각 중 점 → 없음.
    const renderBody = (): ReactNode => {
        if (body) return <AgentMarkdown>{body}</AgentMarkdown>;
        if (!isStreaming) return null;
        if (!m.draft) return <Thinking label={t('MessageList.generating')} />;
        return (
            <div>
                <p className="mb-2 text-xs text-secondary-400">
                    {t('MessageList.redrafting')}
                </p>
                <div className="text-secondary-400">
                    <AgentMarkdown>{m.draft}</AgentMarkdown>
                </div>
            </div>
        );
    };
    return (
        <article
            data-role="assistant"
            style={minHeight === undefined ? undefined : { minHeight }}
            className="group flex flex-col"
        >
            <div className="flex items-start gap-3">
                <SiglensMark className="mt-0.5" />
                <div
                    aria-live={isStreaming ? 'polite' : undefined}
                    className="min-w-0 flex-1 text-[15px] leading-7 break-words text-secondary-100"
                >
                    <ToolActivity tools={m.tools} />
                    {renderBody()}
                    {statusNote[m.status] ?? null}
                    {m.truncated ? (
                        <p className="mt-2 text-xs text-ui-warning-text">
                            {t('MessageList.259976')}
                        </p>
                    ) : null}
                    {!isStreaming && body ? (
                        <RelatedPages
                            pages={relatedPages}
                            labels={symbolLabels}
                            siteUrl={siteUrl}
                            localePrefix={localePrefix}
                        />
                    ) : null}
                    {showFollowUps ? (
                        <FollowUps
                            items={m.followUps ?? []}
                            onPick={onPickFollowUp}
                        />
                    ) : null}
                </div>
            </div>
            {actions}
        </article>
    );
}
