/**
 * @file 허브 카드 제목. 제목 자체가 카드 목적지로 가는 링크다.
 */
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface CardTitleLinkProps {
    readonly label: string;
    readonly href: string;
}

/**
 * 카드 h2. 내부 링크의 앵커 텍스트가 목적지 페이지가 무엇에 관한지 알리는 신호인데,
 * 그 키워드를 가진 것이 제목이라 제목을 링크로 만든다.
 *
 * h2 위계 토큰(`HEADING_SECTION`)을 쓰되 카드 안이라 크기만 `text-base`로 낮춘다 —
 * 같은 페이지의 보조 목록 제목(`/news`의 카테고리 바로가기)과 같은 처방이다.
 */
export function CardTitleLink({ label, href }: CardTitleLinkProps) {
    return (
        <h2 className={cn(HEADING_SECTION, 'mb-1 text-base text-balance')}>
            <Link
                href={href}
                // 카드 그리드로 여러 장 렌더된다. 마운트 즉시 prefetch하면 진입 페이지마다
                // 다른 `_rsc` 키로 같은 목적지를 당겨와 CDN 캐시가 파편화된다.
                prefetch={false}
                className="transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {label}
            </Link>
        </h2>
    );
}
