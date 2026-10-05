import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { newsCategoryLabelKey } from '@/shared/lib/news/categoryDisplay';

interface NewsCategoryBadgeProps {
    /** DB·분석이 준 카테고리 값. 알 수 없거나 `other`면 아무것도 그리지 않는다. */
    value: string | null;
    /** 서피스마다 다른 글자색(`text-secondary-300` 등). */
    className?: string;
}

/**
 * 뉴스 카드의 카테고리 배지 — 종목 뉴스·시장 뉴스 카드 공용.
 *
 * 로케일 라벨(`shared.enumLabel.newsCategory.*`)로 그리고, 라벨이 없는 값은 배지째
 * 뺀다(`categoryDisplay.ts` 참조).
 */
export function NewsCategoryBadge({
    value,
    className,
}: NewsCategoryBadgeProps) {
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는
    // 패턴"만 본다 — `tLabel(key)`를 여기서 직접 불러야 `shared.enumLabel`이
    // 이 컴포넌트를 쓰는 라우트의 클라이언트 번들에 실린다.
    const tLabel = useTranslations('shared.enumLabel');
    const key = newsCategoryLabelKey(value);
    if (key === null) return null;
    return (
        <span
            className={cn(
                'rounded bg-secondary-700 px-2 py-0.5 text-xs',
                className
            )}
        >
            {tLabel(key)}
        </span>
    );
}
