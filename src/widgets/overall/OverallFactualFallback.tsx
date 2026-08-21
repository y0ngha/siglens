import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import type { NewsDisplayItem } from '@/shared/lib/types';

export interface OverallFactualFallbackProps {
    displayName: string;
    marketProfile: MarketProfileId;
    newsItems: readonly NewsDisplayItem[];
}

/**
 * 이 컴포넌트는 `overall/page.tsx`의 Suspense fallback으로 렌더되어 JS 없이
 * 접근하는 크롤러가 그대로 읽는 SSR HTML이다(`OverallContent`가 client
 * 컴포넌트라 non-JS 크롤러에게는 fallback이 사실상 최종 콘텐츠다). `assetClass`
 * 이진 분류(equity/crypto)만으로 축 문구를 고르면 한국 개별주식(assetClass는
 * 'equity'지만 옵션 탭이 없음, `KR_EQUITY_DESCRIPTOR.tabs` 참고)에도 미국
 * 주식과 동일하게 "옵션"을 언급해, 존재하지 않는 옵션 분석을 크롤러에게
 * 약속하게 된다(SEO 감사 2026-08-18) — `marketProfile`로 descriptor의
 * 실제 tabs whitelist를 물어 옵션 탭 존재 여부를 판정한다.
 */
function getAxisKeys(marketProfile: MarketProfileId): readonly string[] {
    const descriptor = getDescriptor(marketProfile);
    if (descriptor.assetClass === 'crypto') {
        return ['chart', 'news', 'fear-greed'];
    }

    if (descriptor.tabs.includes('options')) {
        return ['chart', 'news', 'fundamental', 'options', 'fear-greed'];
    }

    return ['chart', 'news', 'fundamental', 'fear-greed'];
}

/**
 * 축 이름을 로케일에 맞게 잇는다.
 *
 * 예전에는 `'차트, 뉴스, 펀더멘털, 옵션, 공포 탐욕 지수'` 한국어 리터럴을
 * **번역된 템플릿에 꽂았다** — `/en/AAPL/overall`이
 * `Overall Analysis looks at 차트, 뉴스, … together.`를 렌더했다. 이 컴포넌트는
 * JS 없는 크롤러가 읽는 SSR 본문이라 그대로 색인된다.
 *
 * 라벨은 탭바와 같은 `shared.symbolTab`을 쓴다 — 같은 것을 두 번 번역하지 않는다.
 * 구분자는 `Intl.ListFormat`이 정한다(ko `A, B 및 C`, ja/zh는 `、`).
 */
function useAxesText(marketProfile: MarketProfileId): string {
    const tTab = useTranslations('shared.symbolTab');
    const locale = useResolvedLocale();
    return new Intl.ListFormat(INTL_LOCALE[locale], {
        style: 'long',
        type: 'conjunction',
    }).format(getAxisKeys(marketProfile).map(key => tTab(key)));
}

export function OverallFactualFallback({
    displayName,
    marketProfile,
    newsItems,
}: OverallFactualFallbackProps) {
    const t = useTranslations('widgets.overall');
    const axesText = useAxesText(marketProfile);
    const headingId = 'overall-factual-fallback-heading';
    const analyzedNewsCount = newsItems.filter(
        item => item.sentiment !== null
    ).length;

    return (
        <section
            aria-labelledby={headingId}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-5"
        >
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
                {t('OverallFactualFallback.662bc5', { v0: displayName })}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-secondary-300">
                <p>
                    {/* 여는 괄호가 JSX에, 닫는 괄호가 메시지에 나뉘어 있었다 —
                        번역자가 어순을 못 바꾼다. 게다가 `displayName`이 이미
                        `(AAPL)`을 품고 있어 `(AAPL) (AAPL)`로 중복 출력됐다. */}
                    {t('OverallFactualFallback.ab960a', {
                        v0: displayName,
                        v1: axesText,
                    })}
                </p>
                {newsItems.length > 0 ? (
                    <p>
                        {t('OverallFactualFallback.278a07', {
                            v0: newsItems.length,
                            v1: analyzedNewsCount,
                        })}
                    </p>
                ) : (
                    <p>{t('OverallFactualFallback.3a92a1')}</p>
                )}
                <p>{t('OverallFactualFallback.ea75f6')}</p>
            </div>
        </section>
    );
}
