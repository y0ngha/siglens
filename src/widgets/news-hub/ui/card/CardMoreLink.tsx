/**
 * @file 허브 카드 하단의 `더보기 →` 보조 링크.
 */
import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface CardMoreLinkProps {
    readonly href: string;
}

/**
 * 제목 링크와 같은 목적지로 가는 두 번째 앵커 — 클릭 영역을 넓히는 시각 장치다.
 *
 * 보조기술에는 숨긴다(`aria-hidden` + `tabIndex={-1}`): 제목 링크와 목적지가 같아서,
 * 그대로 두면 카드마다 같은 링크가 두 번 읽히고 탭 순서에도 두 번 선다.
 */
export function CardMoreLink({ href }: CardMoreLinkProps) {
    const t = useTranslations('widgets.news-hub');
    return (
        <Link
            href={href}
            prefetch={false}
            aria-hidden="true"
            tabIndex={-1}
            className="mt-auto text-sm text-primary-400 transition-colors hover:text-primary-300"
        >
            {t('CategoryCard.0b6807')} <span aria-hidden="true">→</span>
        </Link>
    );
}
