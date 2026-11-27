import { constants } from 'node:http2';
import { NextResponse } from 'next/server';
import { rejectAiHost } from '@/app/api/_shared/aiHostGuard';
import {
    SITEMAP_CACHE_CONTROL,
    SITEMAP_UNAVAILABLE_BODY,
} from '@/app/api/sitemap/_shared/constants';
import { RETRY_AFTER_SECONDS } from '@/app/api/_shared/constants';
import {
    buildRssItem,
    isEligibleRssSource,
} from '@/app/api/rss/_lib/buildRssItem';
import { loadDeclaredUrls } from '@/app/api/rss/_lib/loadDeclaredUrls';
import { rssSources } from '@/app/api/rss/sources';
import { buildRssXml } from '@/entities/rss-feed/lib/buildRssXml';
import type { RssItem } from '@/entities/rss-feed/model';
import { RSS_FEED_URL } from '@/shared/config/rssFeed';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { brandIntroName, SITE_URL } from '@/shared/lib/seo';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

const { HTTP_STATUS_SERVICE_UNAVAILABLE } = constants;

// sitemap과 같은 이유로 force-dynamic + CDN 캐시다. 항목은 Redis 스탬프에 달려 있어
// 빌드 시점에 굳히면 안 된다.
export const dynamic = 'force-dynamic';

/**
 * 항목이 하나라도 빠진 피드(캐시 미스·스탬프와 본문이 어긋난 순간)의 공개 캐시. 완전한 피드의
 * 1시간+stale 1시간을 그대로 쓰면 일시적으로 줄어든 피드가 CDN에 최대 1시간 남는다 —
 * 짧게만 두고 stale 허용은 없앤다.
 */
export const RSS_PARTIAL_CACHE_CONTROL = 'public, max-age=60';

const CHANNEL = {
    // 한글 표기와 영문 표기를 함께 — 피드 구독 목록·검색에서 "시그렌즈"로도 찾힌다.
    title: `${brandIntroName(DEFAULT_LOCALE)} 시장 브리핑`,
    description:
        '시장 브리핑과 뉴스 요약. 규칙으로 계산한 값을 AI가 문장으로 정리했습니다.',
    language: 'ko',
} as const;

/** 시장 브리핑·뉴스 요약 RSS 2.0 피드. 스탬프가 확인된 허브만 항목으로 싣는다. */
export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;

    // 정적 sitemap 엔트리를 못 읽으면 어떤 허브가 색인 대상인지 모른다 — 빈 피드를 200으로
    // 내면 CDN이 1시간 캐시하고 구독자는 "항목 없음"으로 읽는다. 그래서 503 + Retry-After로
    // 답한다(`Cache-Control`은 두지 않는다 — 장애를 캐시하지 않는다).
    const declaredUrls = await loadDeclaredUrls(new Date());
    if (declaredUrls === null) {
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: { 'Retry-After': RETRY_AFTER_SECONDS },
        });
    }
    // 항목을 낼 수 있는 소스만 센다 — 경로가 없거나 정적 sitemap에 없는 허브는 설계상
    // 빠지는 것이라 피드가 "줄었다"고 볼 수 없다.
    const eligible = rssSources().filter(source =>
        isEligibleRssSource(source, declaredUrls)
    );
    const settled = await Promise.all(
        eligible.map(source =>
            buildRssItem(source, declaredUrls)
                .catch(error => {
                    // 소스 하나의 읽기 실패가 피드 전체를 500으로 만들면 구독자가 피드를 잃는다.
                    console.error(
                        `[rss] ${source.surface} failed:`,
                        redactDbErrorForLog(error)
                    );
                    return null;
                })
                .then(item => {
                    if (item === null) {
                        console.error(
                            `[rss] ${source.surface} dropped out of feed`
                        );
                    }
                    return item;
                })
        )
    );
    const items = settled.filter((item): item is RssItem => item !== null);

    const xml = buildRssXml({
        ...CHANNEL,
        link: SITE_URL,
        selfUrl: RSS_FEED_URL,
        items,
    });
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control':
                items.length < eligible.length
                    ? RSS_PARTIAL_CACHE_CONTROL
                    : SITEMAP_CACHE_CONTROL,
        },
    });
}
