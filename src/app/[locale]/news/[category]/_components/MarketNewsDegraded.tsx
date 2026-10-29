import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface MarketNewsDegradedProps {
    /** 로케일 카탈로그에서 푼 카테고리 라벨 — 안내 문장과 섹션 `aria-label`에 들어간다. */
    readonly label: string;
}

/**
 * 카테고리 목록이 비었을 때(읽기 실패 또는 기사 없음) 목록 자리에 두는 안내 — `generateMetadata`가
 * 같은 판정으로 noindex를 건다. 지역·카테고리 탭은 이 렌더에서도 그대로 남아 막다른 길이 되지 않는다.
 */
export function MarketNewsDegraded({ label }: MarketNewsDegradedProps) {
    const t = useTranslations('app.news');
    return (
        <section
            aria-label={t('page.newsEmptyAria', { v0: label })}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <p className="text-sm text-secondary-400">
                {t('page.fdb87b', { v0: label })}
            </p>
        </section>
    );
}
