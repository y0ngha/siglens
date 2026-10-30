import { cn } from '@/shared/lib/cn';

interface StatCardProps {
    value: string;
    label: string;
    valueClassName: string;
    subLabel?: string;
}

/**
 * 지표 하나(값·라벨·서브라벨).
 *
 * 이 페이지의 유일한 논거는 숫자라 값은 display 크기, 라벨은 읽히는 크기(12px)다.
 *
 * 값에 모노를 쓰지 않는다. `100개`·`10종목`처럼 한글 단위가 숫자에 붙고 Geist Mono에는 한글
 * 글리프가 없어 한 문자열이 두 서체로 쪼개져 조판된다. 자릿수 정렬은 `tabular-nums`가
 * 본문 서체에서 해 준다. 단위만 다른 서체로 쪼개면 텍스트 노드가 갈려 봇이 읽는 문자열이
 * `100개`에서 `100 개`로 바뀐다.
 *
 * 정렬은 가운데가 아니라 **왼쪽**이다. 서브라벨 길이가 카드마다 크게 달라 가운데 정렬에서는
 * 값이 카드마다 다른 x에 떠 표처럼 읽히지 않는다.
 */
export function StatCard({
    value,
    label,
    valueClassName,
    subLabel,
}: StatCardProps) {
    return (
        <div>
            <div
                className={cn(
                    'text-3xl leading-none font-bold tabular-nums sm:text-4xl',
                    valueClassName
                )}
            >
                {value}
            </div>
            <div className="mt-2 text-xs text-secondary-400">{label}</div>
            {/* 서브라벨이 없는 카드도 이 슬롯을 그대로 그린다 — 있는 카드와 바닥선을
                맞추려면 한 줄치 높이를 항상 예약해야 한다. */}
            <div
                data-testid="stat-sub-label"
                className="mt-0.5 min-h-4 text-xs text-secondary-500"
            >
                {subLabel}
            </div>
        </div>
    );
}
