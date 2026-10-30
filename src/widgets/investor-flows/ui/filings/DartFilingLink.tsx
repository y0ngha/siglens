/**
 * DART 공시 원문 링크 — 링크 이름에 보고자를 넣는다.
 */
import { useTranslations } from 'next-intl';
import { FilingLink } from './FilingLink';

interface DartFilingLinkProps {
    readonly url: string;
    readonly reporter: string;
}

/** 표·목록에 "DART 원문"이 여러 개 있어도 스크린리더가 보고자로 구분한다. */
export function DartFilingLink({ url, reporter }: DartFilingLinkProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <FilingLink
            url={url}
            label={t('kr.filing')}
            accessibleName={t('kr.filingLabel', { reporter })}
        />
    );
}
