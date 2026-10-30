'use client';

/** 가이드 검색 결과가 없을 때의 안내 — AI에게 묻기와 필터 지우기. */
import { useTranslations } from 'next-intl';
import { aiAskUrl } from '@/shared/config/aiHost';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { localePath } from '@/shared/i18n/locales';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface GuideEmptyResultsProps {
    /** 사용자가 친 질의(앞뒤 공백 제거 전). AI 질문 문구에 싣는다. */
    readonly query: string;
    readonly onReset: () => void;
}

/** 제목(h2)·설명과, 질의를 실은 `ai.siglens.io` 링크(새 탭) + 필터 지우기 버튼. */
export function GuideEmptyResults({ query, onReset }: GuideEmptyResultsProps) {
    const t = useTranslations('views.guide');
    const locale = useCurrentLocale();
    return (
        <div
            className={cn(SURFACE_CARD, 'mt-4 px-6 py-10 text-center sm:py-12')}
        >
            <h2 className={HEADING_SECTION}>{t('emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-secondary-400">
                {t('emptyBody')}
            </p>
            <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <a
                    href={aiAskUrl(
                        localePath(locale, '/'),
                        t('emptyAiQuestion', { query: query.trim() })
                    )}
                    target="_blank"
                    // 질의마다 다른 `?q=` URL이라 크롤러가 따라가면 색인 가치 없는 URL에 예산을 쓴다.
                    rel="nofollow noopener noreferrer"
                    className={cn(BUTTON_PRIMARY, 'min-h-11 px-5 text-sm')}
                >
                    {t('emptyAskAi')}
                </a>
                <button
                    type="button"
                    onClick={onReset}
                    className={cn(BUTTON_OUTLINE, 'min-h-11 px-5 text-sm')}
                >
                    {t('emptyReset')}
                </button>
            </div>
        </div>
    );
}
