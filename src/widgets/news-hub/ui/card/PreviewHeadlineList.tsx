/**
 * @file 허브 카드의 헤드라인 미리보기 목록(비면 대체 문구).
 */
import { useTranslations } from 'next-intl';
import { distinctPreviewHeadlines } from '../../utils/previewHeadlines';

interface PreviewHeadlineListProps {
    /** 카드 제목. 목록의 접근성 이름에 들어간다. */
    readonly label: string;
    readonly headlines: readonly string[];
}

/**
 * 헤드라인을 한 줄씩 잘라 보여 준다. 빈 값·중복을 걸러낸 뒤 남는 것이 없으면
 * 목록 대신 대체 문구를 렌더한다.
 */
export function PreviewHeadlineList({
    label,
    headlines,
}: PreviewHeadlineListProps) {
    const t = useTranslations('widgets.news-hub');
    const visible = distinctPreviewHeadlines(headlines);

    if (visible.length === 0) {
        return (
            <p className="mb-4 text-sm text-secondary-400">
                {t('CategoryCard.2253f0')}
            </p>
        );
    }

    return (
        <ul
            className="mb-4 min-w-0 space-y-2"
            // `koLabel`이 이미 `…뉴스`로 끝나는 경우가 있어(`미국 시장 뉴스`)
            // 꼬리표에 `뉴스`를 또 붙이면 `뉴스 최신 뉴스`가 된다.
            aria-label={t('CategoryCard.previewLabel', { v0: label })}
        >
            {visible.map(headline => (
                <li
                    key={headline}
                    className="min-w-0 text-sm text-secondary-400"
                >
                    <span className="line-clamp-1 wrap-break-word">
                        {headline}
                    </span>
                </li>
            ))}
        </ul>
    );
}
