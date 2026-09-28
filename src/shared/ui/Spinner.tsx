import { cn } from '@/shared/lib/cn';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/**
 * `primary`/`muted`는 카드·페이지 위, `onFill`은 채움 버튼(흰 글자) 안.
 * 트랙을 투명하게 두고 한 변만 칠하는 두 가지와 달리 `onFill`은 흰 트랙을 40%로 남긴다 —
 * 채움 배경 위에서 투명 트랙은 회전하는 호가 끊겨 보인다.
 */
type SpinnerTone = 'primary' | 'muted' | 'onFill';

const SPINNER_SIZE_CLASS: Record<SpinnerSize, string> = {
    xs: 'size-2.5',
    sm: 'size-3',
    md: 'size-4',
    /** 아이콘 버튼(20px 글리프) 자리 — 공유 버튼이 아이콘과 스피너를 맞바꾼다. */
    lg: 'size-5',
    /** 모달 본문 한가운데의 단독 진행 표시. */
    xl: 'size-8',
};

const SPINNER_TONE_CLASS: Record<SpinnerTone, string> = {
    primary: 'border-primary-500 border-t-transparent',
    muted: 'border-secondary-500 border-t-transparent',
    onFill: 'border-white/40 border-t-white',
};

interface SpinnerProps {
    size?: SpinnerSize;
    tone?: SpinnerTone;
    /** 배치 전용(`shrink-0`, `mt-0.5` 등). 크기·색은 `size`/`tone`으로 고른다. */
    className?: string;
}

/**
 * 장식용 회전 표시. 진행 상태의 **문구**는 호출부가 옆에 두고 라이브 영역으로 알린다 —
 * 스피너 자신은 항상 `aria-hidden`이다. `prefers-reduced-motion`에서는 멈춘 호로 남는다.
 */
export function Spinner({
    size = 'md',
    tone = 'primary',
    className,
}: SpinnerProps) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-block animate-spin rounded-full border-2 motion-reduce:animate-none',
                SPINNER_SIZE_CLASS[size],
                SPINNER_TONE_CLASS[tone],
                className
            )}
        />
    );
}
