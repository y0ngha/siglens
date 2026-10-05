import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatFixed } from '@/shared/lib/formatNum';

type DeltaBasis = 'period' | 'release';

interface DeltaBadgeProps {
    delta: number;
    precision: number;
    /** 이미 해석된 단위 문자열(`deltaUnitLabel`의 결과). */
    unit: string;
    /**
     * 무엇과 비교한 변화인가. 미국 지표 카드는 `period`("전기 대비"), 한국 카드는
     * 캘린더 발표 이력에서 되짚은 값이라 `release`("직전 발표 대비")다.
     */
    basis?: DeltaBasis;
}

/**
 * 직전 값 대비 변화 배지 — 미국·한국 지표 카드가 함께 쓴다.
 *
 * 방향 셰브런은 움직임만 전하고 좋고 나쁨은 말하지 않는다. 물가·실업률처럼 오르는 것이
 * 나쁜 지표에 초록/빨강을 쓰면 의미가 틀리고(MISTAKES #2), 한국 카드가 한때 쓰던
 * "상승=적색"은 같은 카드 묶음 안에서 미국 카드와 반대 해석을 강요했다.
 *
 * 서버 컴포넌트 — 상태가 없다.
 */
export function DeltaBadge({
    delta,
    precision,
    unit,
    basis = 'period',
}: DeltaBadgeProps) {
    const t = useTranslations('widgets.economy');
    const locale = useResolvedLocale();
    // 부동소수점 잔차나 표시 정밀도 미만 변화(예: delta=0.003, precision=2)도
    // 화면에서는 변화 없음이므로 표시 자릿수로 반올림한 값을 기준으로 0 판정한다.
    // (그룹핑된 문자열을 다시 파싱하면 `1,234`가 1이 되므로 숫자로 비교한다.)
    if (Number(delta.toFixed(precision)) === 0) {
        return (
            <span className="mt-1 inline-block text-xs text-secondary-400">
                {basis === 'release'
                    ? t('DeltaBadge.releaseUnchanged')
                    : t('DeltaBadge.unchanged')}
            </span>
        );
    }
    const positive = delta > 0;
    const values = {
        v0: positive ? '+' : '',
        v1: formatFixed(delta, precision, locale),
        v2: unit,
    };
    return (
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-secondary-300">
            <svg
                aria-hidden="true"
                viewBox="0 0 10 10"
                className="h-2.5 w-2.5 fill-none stroke-current"
                strokeWidth={1.5}
            >
                {positive ? (
                    <path d="M2 6.5 5 3.5 8 6.5" />
                ) : (
                    <path d="M2 3.5 5 6.5 8 3.5" />
                )}
            </svg>
            {basis === 'release'
                ? t('DeltaBadge.changeSinceRelease', values)
                : t('DeltaBadge.changeSincePeriod', values)}
        </span>
    );
}
