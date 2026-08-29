import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { useTranslations } from 'next-intl';
/**
 * 항목 **키**만 담는다 — 문구는 `widgets.dashboard.signalGuide`에 있다.
 *
 * 예전에는 `{term, desc}` 8쌍이 한국어 리터럴로 박혀 있어서 `/en/market`의
 * 신호 설명 블록이 통째로 한국어였다. 같은 파일이 제목은 이미 번역하고
 * 있었다 — 반쪽만 옮긴 상태였다.
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
