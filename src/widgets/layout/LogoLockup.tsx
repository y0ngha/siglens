'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useHrefBase } from '@/shared/i18n/LocaleContext';
import { cn } from '@/shared/lib/cn';
import { SITE_NAME } from '@/shared/lib/seo';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { AiNavLink } from './AiNavLink';

/**
 * Logo lockup: `[icon] SIGLENS` + `AI`. Two anchors because they are two
 * destinations on both hosts — `SIGLENS` is the site home (siglens.io, via
 * `LocaleLink`'s link base on the ai host), `AI` is the AI product — and
 * visually one wordmark, so the gap is tighter than the header row's.
 *
 * A client island because it reads the link base: on ai.siglens.io the
 * wordmark stays visible on phones so the lockup still reads "SIGLENS AI".
 * The logo there used to open the AI home, which left no way back to the
 * main site from the header (2026-09-13 사용자 제보). `Header` itself stays
 * hook-free so it can remain a server component.
 */
export function LogoLockup() {
    const t = useTranslations('widgets.layout');
    const onAiHost = useHrefBase() !== '';
    return (
        // Two destinations, so they read as two: a gap plus a hairline between
        // the site logo and the AI product. At `gap-1` the pair read as one
        // wordmark ("SIGLENS AI"), not a home link next to a product link
        // (2026-09-13 사용자 제보).
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
                href="/"
                title={t('Header.d8c261')}
                // 전역 헤더 로고 — 모든 페이지에서 렌더된다. prefetch는 진입 페이지마다
                // 다른 `_rsc` 해시를 만들어 `/`의 캐시를 파편화시킨다
                // (docs/architecture/CDN_CACHING.md §1).
                prefetch={false}
                // Visible brand text is `text-...uppercase` (renders "SIGLENS"),
                // so the accessible name must match what users see (WCAG 2.5.3)
                // — and where the link goes: the site home on both hosts.
                aria-label={t('Header.homeLabel', {
                    v0: SITE_NAME.toUpperCase(),
                })}
                className="-mx-1 flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {/*
                    icon96.png(96×96)을 24×24로 렌더 — Lighthouse의
                    `image-size-responsive` audit이 1.5× DPI(36×36) 기준으로
                    검증하므로 source가 display의 최소 1.5× 이상이어야 한다.
                    `unoptimized`를 제거해 next/image가 24/48 responsive 변형을
                    자동 생성·서빙하도록 한다(WebP 변환 포함, 실제 전송 바이트는
                    원본보다 작다).

                    `priority`(Next 16에서는 `preload`)를 걸지 않는다. 24px 로고는 어느
                    페이지에서도 LCP 요소가 아닌데, 모든 페이지 `<head>`에 고우선
                    preload를 박아 LCP 후보(히어로 텍스트·차트)와 대역을 다퉜다
                    (재현: 아무 페이지 view-source의 `<head>`에서
                    `<link rel="preload" as="image">` 중 icon96을 찾는다 — 지금은 없어야 한다).
                    크기가 고정이라 늦게 도착해도 레이아웃이 밀리지 않는다. 다만 늘
                    첫 화면(헤더)에 있으므로 `loading="eager"`로 lazy 판정 지연만 없앤다 —
                    preload 링크 없이 보통 우선순위로 받는다.
                */}
                <Image
                    src="/icon96.png"
                    alt={t('Header.1ebe53')}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                    loading="eager"
                />
                <span
                    translate="no"
                    className={cn(
                        'font-mono text-sm font-semibold tracking-[0.15em] text-secondary-100 uppercase',
                        onAiHost ? 'inline' : 'hidden sm:inline'
                    )}
                >
                    {SITE_NAME}
                </span>
            </Link>
            <span
                aria-hidden="true"
                className="h-4 w-px shrink-0 bg-secondary-600"
            />
            <AiNavLink variant="wordmark" />
        </div>
    );
}
