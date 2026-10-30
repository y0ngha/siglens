'use client';

import { AI_SITE_URL } from '@/shared/config/aiHost';
import { useCurrentLocale, useHrefBase } from '@/shared/i18n/LocaleContext';
import { localePath } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';

interface AiNavLinkTarget {
    /** 현재 로케일의 ai.siglens.io 홈 절대 URL. */
    readonly href: string;
    /** 로케일 표기의 제품명(ko `시그렌즈 AI`, 그 외 `SIGLENS AI`). */
    readonly brandLabel: string;
    /** ai 호스트에서 렌더 중인가 — 이때 링크가 현재 페이지다. */
    readonly onAiHost: boolean;
}

/**
 * AI 진입 링크가 그릴 목적지·이름·현재 페이지 여부.
 *
 * ai 호스트에서도 같은 헤더가 렌더되며, 그때는 링크 기준(`useHrefBase`)이 비어 있지 않다.
 */
export function useAiNavLinkTarget(): AiNavLinkTarget {
    const locale = useCurrentLocale();
    const onAiHost = useHrefBase() !== '';
    return {
        href: `${AI_SITE_URL}${localePath(locale, '/')}`,
        brandLabel: brandAiName(locale),
        onAiHost,
    };
}
