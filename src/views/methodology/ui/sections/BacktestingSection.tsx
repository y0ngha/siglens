/**
 * `/methodology` "백테스트" — 백테스트 페이지가 무엇을 재고 무엇을 빼는지.
 */
import { cn } from '@/shared/lib/cn';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { MethodologySectionProps } from '../../types';
import { MethodologySection } from '../layout/MethodologySection';
import { BODY_TEXT, TEXT_LINK } from '../methodologyStyles';

/** 계산 방식과 한계(백테스트 페이지가 스스로 밝히는 것과 같다), `/backtesting` 링크. */
export function BacktestingSection({ t, title }: MethodologySectionProps) {
    return (
        <MethodologySection id="backtesting" title={title}>
            <p className={cn(BODY_TEXT, 'mt-4')}>{t('backtesting.body')}</p>
            <p className={cn(BODY_TEXT, 'mt-3')}>{t('backtesting.caveat')}</p>
            <LocaleLink
                href="/backtesting"
                prefetch={false}
                className={cn(TEXT_LINK, 'mt-2 text-sm')}
            >
                {t('backtesting.link')}
            </LocaleLink>
        </MethodologySection>
    );
}
