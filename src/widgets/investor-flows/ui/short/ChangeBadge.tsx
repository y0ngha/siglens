/**
 * 직전 결제일 대비 공매도 잔고 증감 배지 — 방향 기호 + 부호 있는 % + 글자.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatSignedPercent } from '../../utils/flowFormat';
import { changeDirection, type ChangeDirection } from '../../utils/short';

/** 색과 별개로 붙는 방향 기호. */
const DIRECTION_MARK: Record<ChangeDirection, string> = {
    up: '▲',
    down: '▼',
    flat: '■',
};

/** 방향은 소수 첫째 자리 반올림 기준(`changeDirection`)이고, 표시하는 숫자도 같은 자리로 맞춘다. */
export function ChangeBadge({ changePct }: { readonly changePct: number }) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const direction = changeDirection(changePct);
    // 라벨은 리터럴 번역 호출로 만들어 두고 방향으로 고른다(추출기가 키를 볼 수 있게).
    const labels: Record<ChangeDirection, string> = {
        up: t('short.changeUp'),
        down: t('short.changeDown'),
        flat: t('short.changeFlat'),
    };
    return (
        <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">{DIRECTION_MARK[direction]}</span>
            <span className="font-mono">
                {formatSignedPercent(changePct, locale)}
            </span>
            <span className="text-xs font-normal text-secondary-300">
                {labels[direction]}
            </span>
        </span>
    );
}
