/** 경쟁 모델 한 곳과의 점수 차 카드. */
import { SummaryCard } from './SummaryCard';
import { SummaryCardNote } from './SummaryCardNote';

interface Props {
    /** "{경쟁 모델} 대비" 라벨. */
    readonly label: string;
    readonly diffText: string;
    /** 신뢰구간 문구(라벨 포함). */
    readonly ciText: string;
    /** 비교 해석 문구. */
    readonly verdictText: string;
    /** 비교에 쓴 문항 수 문구. */
    readonly questionsText: string;
}

/** 점수 차를 크게, 신뢰구간·해석·문항 수를 그 아래에 둔다. */
export function CompetitorCard({
    label,
    diffText,
    ciText,
    verdictText,
    questionsText,
}: Props) {
    return (
        <SummaryCard label={label} value={diffText}>
            <SummaryCardNote numeric>
                {ciText} <span aria-hidden="true">|</span> {verdictText}
            </SummaryCardNote>
            <SummaryCardNote numeric>{questionsText}</SummaryCardNote>
        </SummaryCard>
    );
}
