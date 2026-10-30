/**
 * 점수표 방향 라벨 배지 — 색 + 기호 + 글자 세 겹으로 방향을 전한다.
 */
import { useTranslations } from 'next-intl';
import type { InvestorFlowsLabel } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { GAP_MARK, type AxisGap } from '../../utils/scorecardGap';
import {
    LABEL_CLASS,
    LABEL_KEY,
    LABEL_MARK,
} from '../../utils/scorecardLabels';

interface LabelBadgeProps {
    readonly label: InvestorFlowsLabel;
    /** "데이터 부족" 대신 말할 사유(중립도, 부족도 아니다). */
    readonly gap?: AxisGap | null;
}

/** 사유가 있으면 라벨 대신 사유의 기호·글자를 보인다. */
export function LabelBadge({ label, gap = null }: LabelBadgeProps) {
    // 동적 키는 하위 네임스페이스 번역자로만 부른다 — 파일 전체 네임스페이스가 클라이언트에 실리지 않게.
    const tLabel = useTranslations('widgets.investor-flows.label');
    // 사유별 문구는 리터럴 호출로 만들어 둔다(`i18n:extract`가 동적 키를 못 읽어 메시지를 지우기 때문).
    const gapLabels: Record<AxisGap, string> = {
        collecting: tLabel('collecting'),
        unavailable: tLabel('unavailable'),
        noRecentReports: tLabel('noRecentReports'),
    };
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                LABEL_CLASS[label]
            )}
        >
            <span aria-hidden="true">
                {gap === null ? LABEL_MARK[label] : GAP_MARK[gap]}
            </span>
            {gap === null ? tLabel(LABEL_KEY[label]) : gapLabels[gap]}
        </span>
    );
}
