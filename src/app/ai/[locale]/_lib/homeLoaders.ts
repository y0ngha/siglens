import { getTranslations } from 'next-intl/server';
import { getAgentSuggestions } from '@/entities/agent-suggestions/api';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import type { AiSeoCopy } from '@/shared/config/aiHost';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';

/** 랜딩의 `generateMetadata`와 JSON-LD가 함께 쓰는 SEO 문구. */
export async function getAiHomeSeoCopy(locale: Locale): Promise<AiSeoCopy> {
    const t = await getTranslations({ locale, namespace: 'app.ai' });
    return {
        title: t('seo.title'),
        description: t('seo.description'),
        ogLabel: t('seo.ogLabel'),
    };
}

/**
 * 로그인 사용자의 빈 화면 AI 제안. 포트폴리오 심볼이 채팅 턴(`stream/route.ts`)과 똑같이
 * 프롬프트에 들어간다. 실패는 로그만 남기고 `null`로 접어 `EmptyState`가 정적 대체 제안을
 * 그리게 한다 — 게스트는 이 함수에 오지 않는다.
 */
export async function loadAiHomeSuggestions(
    userId: string,
    locale: Locale
): Promise<string[] | null> {
    try {
        const holdings = await new DrizzlePortfolioRepository(
            getDatabaseClient().db
        ).findByUser(userId);
        return await getAgentSuggestions({
            locale,
            userId,
            portfolioSymbols: holdings.map(h => h.symbol),
        });
    } catch (error) {
        console.error('[AiHomePage] loadSuggestions failed:', error);
        return null;
    }
}
