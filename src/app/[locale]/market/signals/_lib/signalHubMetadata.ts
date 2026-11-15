import 'server-only';

import type { Metadata } from 'next';
import type { SignalHub } from '@/entities/signal-history/lib/signalHubs';
import type { Locale } from '@/shared/i18n/locales';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { isSignalHubDataIndexable } from './isSignalHubDataIndexable';
import { loadSignalHub } from './loadSignalHub';
import { signalHubCopy } from './signalHubCopy';

/**
 * 신호 페이지 메타데이터. 색인 판정은 본문의 구조화데이터와 같은 함수(`isSignalHubDataIndexable`)이고,
 * 사이트맵도 그 안의 같은 기준(`isSignalHubIndexable`)을 쓴다.
 * 기록을 못 읽었거나(degraded) 행이 모자라면 `noindex,follow` + 자기 canonical — 얇은 목록을 색인
 * 시키지 않되 페이지 안 링크는 따라가게 둔다.
 */
export async function signalHubMetadata(
    params: Promise<{ locale: string }>,
    locale: Locale,
    hub: SignalHub
): Promise<Metadata> {
    const [copy, data] = await Promise.all([
        signalHubCopy(hub),
        loadSignalHub(hub.signalType),
    ]);
    return buildHubMetadata({
        params,
        locale,
        path: copy.path,
        title: copy.title,
        description: copy.description,
        keywords: copy.keywords,
        degraded: !isSignalHubDataIndexable(data),
    });
}
