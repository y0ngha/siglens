import {
    isSignalHubIndexable,
    SIGNAL_HUBS,
    signalHubPath,
} from '@/entities/signal-history/lib/signalHubs';
import type { SignalHubCount } from '@/entities/signal-history/types';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';
import { sitemapAlternates } from './sitemapAlternates';

/** 신호 페이지는 장 마감마다 목록이 바뀐다. 우선순위는 종목 페이지(0.8)보다 낮은 목록 페이지 수준이다. */
const SIGNAL_HUB_CHANGE_FREQUENCY = 'daily' as const;
const SIGNAL_HUB_PRIORITY = 0.6;

/**
 * 색인할 수 있는 신호 페이지만 사이트맵에 싣는다 — 페이지 메타데이터와 같은 술어
 * (`isSignalHubIndexable`)라, noindex로 내보내는 얇은 페이지를 사이트맵이 "수집하라"고 권하지 않는다.
 * lastmod는 그 신호의 가장 최근 마지막 포착 세션이다 — 이어진 에피소드도 "마지막 포착일"이 바뀌어
 * 페이지 본문이 달라진다.
 */
export function buildSignalHubSitemapEntries(
    counts: readonly SignalHubCount[]
): SitemapEntry[] {
    const bySignal = new Map(counts.map(count => [count.signalType, count]));
    return SIGNAL_HUBS.flatMap(hub => {
        const count = bySignal.get(hub.signalType);
        if (count === undefined || !isSignalHubIndexable(count.symbols))
            return [];
        const lastModified = new Date(`${count.latestSession}T00:00:00Z`);
        if (Number.isNaN(lastModified.getTime())) return [];
        const path = signalHubPath(hub.slug);
        return [
            {
                url: `${SITE_URL}${path}`,
                lastModified,
                changeFrequency: SIGNAL_HUB_CHANGE_FREQUENCY,
                priority: SIGNAL_HUB_PRIORITY,
                alternates: sitemapAlternates(path, STATIC_INDEXABLE_LOCALES),
            },
        ];
    });
}
