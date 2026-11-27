import { useTranslations } from 'next-intl';
import type { SkillCounts } from '@y0ngha/siglens-core';
import { GUIDE_CATEGORIES, type GuideCategory } from '@/entities/guide/types';
import { StatsBar } from '@/widgets/home/StatsBar';
import { guideCategoryPath, GUIDE_PATH } from '@/shared/lib/guidePaths';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

const HEADING_ID = 'home-method-band-heading';

interface HomeMethodBandProps {
    /** 히어로 카피와 같은 `skillCounts` — 같은 수를 말한다. */
    readonly counts: SkillCounts;
    /** 비회원이 하루에 세부 가격(지지·저항·무효화)을 볼 수 있는 종목 수. 코어 정책에서 읽어 넘긴다. */
    readonly guestDailySymbols: number;
    /** 가이드 분류 표시명 — 가이드 허브와 같은 카탈로그 키에서 온 값이다(`loadGuideCategoryCopy`). */
    readonly categoryLabels: Readonly<Record<GuideCategory, string>>;
}

/**
 * 홈의 "가격대는 이렇게 정해요" 띠. 예전의 통계 줄, 백테스팅 카드, 기법 카드 격자가 하던 말을 한
 * 카드에 모은다: 무엇을 보여 주는지(지지선·저항선, 무효화 기준)와 어떻게 믿을 만한지(지난 기록).
 * 가이드 분류 5개로 가는 링크 줄이 기법 카드가 내던 가이드 링크의 입구 역할을 이어받는다.
 *
 * 서버 컴포넌트다(`StatsBar`도 서버에서 그려진다). 링크는 `prefetch={false}` — 랜딩은 트래픽이
 * 가장 많은 페이지라 prefetch를 켜면 링크 하나가 `_rsc` 요청을 대량으로 만든다.
 */
export function HomeMethodBand({
    counts,
    guestDailySymbols,
    categoryLabels,
}: HomeMethodBandProps) {
    const t = useTranslations('app.home.methodBand');
    const items = [
        {
            id: 'levels',
            title: t('levelsTitle'),
            body: t('levelsBody'),
            linkLabel: t('levelsLink'),
            href: '/methodology',
        },
        {
            id: 'invalidation',
            title: t('invalidationTitle'),
            body: t('invalidationBody', { count: guestDailySymbols }),
            linkLabel: t('invalidationLink'),
            href: GUIDE_PATH,
        },
        {
            id: 'history',
            title: t('historyTitle'),
            body: t('historyBody'),
            linkLabel: t('historyLink'),
            href: '/backtesting',
        },
    ];

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-5 sm:p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_SECTION}>
                {t('heading')}
            </h2>
            <StatsBar counts={counts} />
            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {items.map(item => (
                    <li key={item.id}>
                        <h3 className={HEADING_SUBSECTION}>{item.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                            {item.body}
                        </p>
                        <Link
                            href={item.href}
                            prefetch={false}
                            className={cn(
                                LINK_ACCENT,
                                'mt-1 inline-flex min-h-10 items-center rounded text-sm'
                            )}
                        >
                            {item.linkLabel}
                        </Link>
                    </li>
                ))}
            </ul>
            <nav
                aria-label={t('guideCategoriesLabel')}
                className="mt-4 border-t border-secondary-700 pt-4"
            >
                <ul className="flex flex-wrap gap-2">
                    {GUIDE_CATEGORIES.map(category => (
                        <li key={category}>
                            <Link
                                href={guideCategoryPath(category)}
                                prefetch={false}
                                className="inline-flex min-h-9 items-center rounded-full border border-border-control px-3 text-xs text-secondary-200 hover:border-primary-500 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {categoryLabels[category]}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </section>
    );
}
