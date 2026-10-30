/**
 * 미래 방향 카드의 애널리스트 등급 섹션(제목·툴팁·분포 막대).
 */
import { useTranslations } from 'next-intl';
import type { FundamentalGradesConsensusInput } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { GradesBar } from './GradesBar';

interface RatingsSectionProps {
    grades: FundamentalGradesConsensusInput;
}

/** 등급 분포 섹션. 표시할 등급이 있는 경우에만 호출한다. */
export function RatingsSection({ grades }: RatingsSectionProps) {
    const t = useTranslations('widgets.fundamental');
    return (
        <div>
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('FutureDirectionCard.5039cb')}
                <InfoTooltip>
                    <p>{t('FutureDirectionCard.b69220')}</p>
                    <p>{t('FutureDirectionCard.ebde29')}</p>
                </InfoTooltip>
            </h3>
            <GradesBar grades={grades} />
        </div>
    );
}
