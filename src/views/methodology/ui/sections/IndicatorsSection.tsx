/**
 * `/methodology` "지표와 패턴 계산" — 숫자는 규칙이 계산한다는 설명과 대표 지표 예시.
 */
import type { SkillCounts } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { BODY_TEXT, TEXT_LINK } from '../methodologyStyles';

interface Props extends MethodologySectionProps {
    /** 홈·`/about`과 같은 소스(`countSkillFiles`)의 개수. */
    readonly counts: SkillCounts;
}

/**
 * 규칙 계산 설명, 실제 스킬 개수, 대표 지표 네 개의 정의, 가이드·백테스트 링크.
 *
 * 두 링크는 각자 `<li>`에 둔다 — 형제 인라인 앵커로 붙여 두면 줄바꿈이 CSS(세로
 * flex)에만 있어, 스타일 없이 읽히는 텍스트(리더 모드·텍스트 추출)에서 두 링크 문구가
 * 한 문장처럼 이어 붙는다. `<li>`를 flex로 두어 앵커의 박스는 전과 같다.
 */
export function IndicatorsSection({ t, title, counts }: Props) {
    const terms = [
        { term: t('indicators.ma'), body: t('indicators.maBody') },
        { term: t('indicators.rsi'), body: t('indicators.rsiBody') },
        { term: t('indicators.macd'), body: t('indicators.macdBody') },
        {
            term: t('indicators.bollinger'),
            body: t('indicators.bollingerBody'),
        },
    ];
    const links = [
        { href: guideCategoryPath('indicators'), label: t('indicators.guide') },
        { href: '/backtesting', label: t('indicators.backtest') },
    ];
    return (
        <MethodologySection
            id="indicators"
            title={title}
            sub={t('indicators.sub')}
        >
            <p className={cn(BODY_TEXT, 'mt-4')}>{t('indicators.rules')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>
                {t('indicators.counts', {
                    indicators: counts.indicators,
                    candles: counts.candlesticks,
                    patterns: counts.patterns,
                    strategies: counts.strategies,
                })}
            </p>
            <h3 className={cn(HEADING_SUBSECTION, 'mt-6')}>
                {t('indicators.examplesTitle')}
            </h3>
            <dl className="mt-3 flex max-w-2xl flex-col gap-3">
                {terms.map(item => (
                    <div
                        key={item.term}
                        className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[8rem_minmax(0,1fr)]"
                    >
                        <dt className="text-sm font-semibold text-secondary-100">
                            {item.term}
                        </dt>
                        <dd className="text-sm leading-6 text-secondary-300">
                            {item.body}
                        </dd>
                    </div>
                ))}
            </dl>
            <ul className="mt-3 flex flex-col items-start gap-1.5">
                {links.map(link => (
                    <li key={link.href} className="flex">
                        <LocaleLink
                            href={link.href}
                            prefetch={false}
                            className={cn(TEXT_LINK, 'text-sm')}
                        >
                            {link.label}
                        </LocaleLink>
                    </li>
                ))}
            </ul>
        </MethodologySection>
    );
}
