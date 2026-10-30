/**
 * `/methodology` "정정과 오류 신고" — 신고 경로와 고치는 방식.
 */
import { cn } from '@/shared/lib/cn';
import { ABOUT_PATH, SITE_OPERATOR } from '@/shared/lib/legal';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { BODY_TEXT, TEXT_LINK } from '../methodologyStyles';

/** 신고·수정 안내와 운영자 이메일, `/about` 링크. */
export function CorrectionsSection({ t, title }: MethodologySectionProps) {
    return (
        <MethodologySection id="corrections" title={title}>
            <p className={cn(BODY_TEXT, 'mt-4')}>{t('corrections.report')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>{t('corrections.fix')}</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-0 text-sm">
                <li>
                    <a
                        href={`mailto:${SITE_OPERATOR.email}`}
                        className={TEXT_LINK}
                    >
                        {t('corrections.emailLabel')}
                    </a>
                </li>
                <li>
                    <LocaleLink
                        href={ABOUT_PATH}
                        prefetch={false}
                        className={TEXT_LINK}
                    >
                        {t('corrections.aboutLink')}
                    </LocaleLink>
                </li>
            </ul>
        </MethodologySection>
    );
}
