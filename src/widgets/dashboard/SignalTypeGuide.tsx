/**
 * 신호 유형 가이드 — 대시보드에 나오는 신호의 뜻을 용어/설명 목록으로 풀어 준다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

/**
 * 항목 **키**만 담는다 — 문구는 `widgets.dashboard.signalGuide`에 있다. 한국어 리터럴을
 * 박아 두면 `/en/market`의 신호 설명 블록이 통째로 한국어가 된다.
 */
const ENTRY_KEYS = [
    'goldenCross',
    'deathCross',
    'rsiExtremes',
    'bollingerBands',
    'rsiDivergence',
    'macdHistogram',
    'bollingerSqueeze',
    'supportResistance',
] as const;

/** 항목 키 표를 순회해 용어(dt)와 설명(dd)을 그린다. */
export function SignalTypeGuide() {
    const t = useTranslations('widgets.dashboard');
    return (
        <section
            className="page-container py-10"
            aria-labelledby="signal-guide-heading"
        >
            <h2
                id="signal-guide-heading"
                className={cn('mb-6', HEADING_SECTION)}
            >
                {t('SignalTypeGuide.03876a')}
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                {ENTRY_KEYS.map(key => (
                    <div key={key}>
                        <dt className="text-sm font-semibold text-secondary-300">
                            {t(`signalGuide.${key}.term`)}
                        </dt>
                        <dd className="text-xs leading-relaxed text-secondary-500">
                            {t(`signalGuide.${key}.desc`)}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
