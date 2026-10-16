import { useTranslations } from 'next-intl';
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';

const LINK_CLASS =
    'tap-target rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * DART 공시 원문 링크(새 탭). 링크 이름에 보고자를 넣어 표·목록에서 "DART 원문"이 여러 개 있어도 스크린리더가 구분한다.
 * 안전한 http(s) 주소가 아니면 링크 대신 대시를 둔다.
 */
export function DartFilingLink({
    url,
    reporter,
}: {
    readonly url: string;
    readonly reporter: string;
}) {
    const t = useTranslations('widgets.investor-flows');
    const href = toSafeHttpUrl(url);
    if (href === null)
        return <span className="text-xs text-secondary-400">–</span>;
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('kr.filingLabel', { reporter })}
            className={LINK_CLASS}
        >
            {t('kr.filing')}
        </a>
    );
}
