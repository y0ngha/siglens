/**
 * 마켓 뉴스 카드의 가격 영향 배지.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import {
    IMPACT_LABEL_KEY,
    IMPACT_CLASS,
    isNewsImpact,
} from '@/shared/lib/news/impactDisplay';

interface ImpactBadgeProps {
    value: string;
}

/** 알 수 없는 값이면 아무것도 그리지 않는다. */
export function ImpactBadge({ value }: ImpactBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    // 감성 배지와 같은 이유로 키를 그대로 번역자에 넣는다 —
    // 추출기가 이 파일에서 `shared.enumLabel`을 보게 해야 페이로드에 실린다.
    if (!isNewsImpact(value)) return null;
    return (
        <span
            className={cn(
                'rounded px-2 py-0.5 text-xs font-medium',
                IMPACT_CLASS[value]
            )}
        >
            {tLabel(IMPACT_LABEL_KEY[value])}
        </span>
    );
}
