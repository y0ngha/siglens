/**
 * 숏스퀴즈 점수의 출처 안내 한 줄 — 쓰인 출처와(있다면) 가격 기준일.
 */
import { useTranslations } from 'next-intl';
import type { SqueezeRiskScore } from '@y0ngha/siglens-core';
import { squeezeSources, type SqueezeSource } from '../../utils/squeeze';

/** 숏스퀴즈 점수의 출처 안내. */
export function SqueezeSourceNote({
    risk,
}: {
    readonly risk: SqueezeRiskScore;
}) {
    const t = useTranslations('widgets.investor-flows');
    // 출처 이름은 리터럴 번역 호출로 만들어 두고 출처로 고른다(추출기가 키를 볼 수 있게).
    const sourceLabels: Record<SqueezeSource, string> = {
        finra: t('squeeze.sourceFinra'),
        sec: t('squeeze.sourceSec'),
        exchange: t('squeeze.sourceExchange'),
        price: t('squeeze.sourcePrice'),
    };
    const sources = squeezeSources(risk)
        .map(source => sourceLabels[source])
        .join(', ');
    return (
        <p className="text-xs text-secondary-400">
            {risk.lastBarDate === null
                ? t('squeeze.sources', { sources })
                : t('squeeze.sourcesWithPrice', {
                      sources,
                      date: risk.lastBarDate,
                  })}
        </p>
    );
}
