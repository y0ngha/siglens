import type { Metadata } from 'next';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { listConversationsAction } from '@/entities/chat-conversation/actions/listConversationsAction';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { ChatShell } from '@/widgets/agent-chat/ChatShell';
import { buildAiHomeJsonLd, buildAiHomeMetadata } from './_lib/aiSeo';
import { maybeHandoffRedirect } from './_lib/handoffRedirect';
import { draftFrom } from './_lib/homeDraft';
import { getAiHomeSeoCopy, loadAiHomeSuggestions } from './_lib/homeLoaders';
import { localePrefixOf } from './_lib/localePrefix';

/**
 * 이 라우트에는 의도적으로 `loading.tsx`가 없다. 있으면 스트리밍 응답의 보이는 HTML이
 * 로딩 스켈레톤뿐이고 랜딩 본문(가이드·FAQ·예시)이 JS가 나중에 바꿔 끼우는
 * `<div hidden id="S:…">` 청크에 들어가, JS 없는 크롤러와 `curl`은 스켈레톤만 봤다(프로덕션
 * 실측). 아래의 나머지 await(세션·대화 목록·SEO 문구)는 빠르고, 느린 부분(AI 제안, LLM 최대
 * 8초)은 `EmptyState` 자체의 Suspense 경계 안에서 스트리밍된다.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: raw } = await params;
    const locale = resolveLocale(raw);
    return buildAiHomeMetadata(locale, await getAiHomeSeoCopy(locale));
}

export default async function AiHomePage({
    params,
    searchParams,
}: {
    readonly params: Promise<{ locale: string }>;
    readonly searchParams: Promise<
        Record<string, string | string[] | undefined>
    >;
}) {
    const { locale: raw } = await params;
    const locale = enterLocale(raw);
    const sp = await searchParams;
    await maybeHandoffRedirect(locale, '/', sp);
    const user = await getCurrentUser();
    // 제안은 await 없이 내려보낸다: 캐시 미스면 LLM이 만들어(최대 8초) 여기서 기다리면
    // 랜딩 전체가 막히고, 본문이 스켈레톤 뒤 숨김 청크로 스트리밍돼 JS 없는 크롤러가 못 본다.
    const suggestions = user ? loadAiHomeSuggestions(user.id, locale) : null;
    const [conversations, copy] = await Promise.all([
        user ? listConversationsAction() : Promise.resolve([]),
        getAiHomeSeoCopy(locale),
    ]);
    const localePrefix = localePrefixOf(locale);
    return (
        <>
            <JsonLd data={buildAiHomeJsonLd(locale, copy)} />
            <ChatShell
                conversationId={null}
                initialMessages={[]}
                conversations={conversations}
                signedIn={user !== null}
                localePrefix={localePrefix}
                siteUrl={SITE_URL}
                currentPath={`${localePrefix}/`}
                suggestions={suggestions}
                initialDraft={draftFrom(sp)}
            />
        </>
    );
}
