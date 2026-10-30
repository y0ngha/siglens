'use client';

import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { CONFIDENCE_THRESHOLD_PERCENTS } from '../../utils/confidenceTier';

/**
 * 신뢰도 점수 설명 ⓘ — 섹션 제목 옆에 **한 번만** 렌더한다.
 *
 * 설명은 모든 카드에 공통이라 카드마다 달면 같은 문장이 카드 수만큼 HTML에 반복돼
 * 홈에서 가장 자주 나오는 문구가 핵심 키워드 대신 이 안내문이 된다. 열기/닫기,
 * Escape(WCAG 1.4.13), 터치는 공용 `InfoTooltip`이 맡는다.
 */
export function ConfidenceInfo() {
    const t = useTranslations('widgets.home');

    return (
        <InfoTooltip className="ml-0" label={t('SkillsShowcase.7e6540')}>
            <div className="leading-relaxed text-secondary-300">
                <p>{t('SkillsShowcase.ebff92')}</p>
                <p>
                    {t('SkillsShowcase.confidenceTiers', {
                        low: CONFIDENCE_THRESHOLD_PERCENTS.low,
                        high: CONFIDENCE_THRESHOLD_PERCENTS.high,
                    })}
                </p>
                <p>{t('SkillsShowcase.e0f5c5')}</p>
            </div>
        </InfoTooltip>
    );
}
