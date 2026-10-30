import { LABEL_GROUP } from '@/shared/lib/typographyStyles';
import type { FooterColumn } from '../../utils/footerColumns';
import { FooterTextLink } from './FooterTextLink';

interface FooterNavColumnProps {
    readonly column: FooterColumn;
}

/**
 * 사이트맵 열 하나.
 *
 * 열 제목은 `<h2>`가 아니라 `<p>` + `aria-labelledby`다. 푸터는 모든 라우트에 렌더되므로
 * 헤딩으로 쓰면 전 페이지 문서 개요에 h2가 네 개씩 섞여 들어간다. 목록에 이름을 붙이는 것만으로
 * 스크린리더의 그룹 인지에는 충분하다.
 */
export function FooterNavColumn({ column }: FooterNavColumnProps) {
    const headingId = `footer-nav-${column.id}`;
    return (
        <div>
            <p id={headingId} className={LABEL_GROUP}>
                {column.label}
            </p>
            <ul aria-labelledby={headingId} className="mt-3 space-y-2">
                {column.links.map(link => (
                    <li key={link.href}>
                        <FooterTextLink href={link.href}>
                            {link.label}
                        </FooterTextLink>
                    </li>
                ))}
            </ul>
        </div>
    );
}
