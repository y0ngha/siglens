import type { BenchmarkLabel } from '@/entities/benchmark/types';
import { cn } from '@/shared/lib/cn';

/**
 * 판정별 색. 색만으로 뜻을 싣지 않는다 — 칩은 항상 판정 이름 텍스트를 함께 그린다.
 * 정답/오답은 성공/위험 상태 토큰이고 방향 색(teal/red 상승·하락)이 아니다. 부분 정답은
 * 제외·채점 전(회색)과 구분되도록 브랜드 파랑을 쓴다.
 */
const TONE: Readonly<Record<BenchmarkLabel, string>> = {
    correct: 'border-ui-success/40 bg-ui-success/10 text-ui-success-text',
    partial: 'border-primary-500/40 bg-primary-500/10 text-primary-300',
    incorrect: 'border-ui-danger/40 bg-ui-danger/10 text-ui-danger-text',
    not_attempted: 'border-ui-warning/40 bg-ui-warning/10 text-ui-warning-text',
    excluded: 'border-secondary-700 bg-secondary-900 text-secondary-400',
    pending: 'border-secondary-700 bg-secondary-900 text-secondary-400',
};

interface Props {
    readonly label: BenchmarkLabel;
    /** 판정 이름(번역됨). */
    readonly text: string;
    /** 대상 이름. 있으면 칩 앞에 붙는다. */
    readonly target?: string;
    readonly className?: string;
}

export function BenchmarkVerdictChip({
    label,
    text,
    target,
    className,
}: Props) {
    return (
        <span
            data-verdict={label}
            className={cn(
                'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs leading-5 whitespace-nowrap',
                TONE[label],
                className
            )}
        >
            {target ? (
                <span className="font-semibold" translate="no">
                    {target}
                </span>
            ) : null}
            <span>{text}</span>
        </span>
    );
}
