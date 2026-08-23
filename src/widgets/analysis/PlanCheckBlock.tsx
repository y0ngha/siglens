import type { PlanCheck } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';

/**
 * 계획과 현재가의 차이를 보여 주는 블록.
 *
 * 매매 전략 본문의 손익비는 AI가 문장으로 쓴 것이고, 그 계산의 기준은 AI가 제안한
 * **진입가**다. 현재가가 그 자리를 이미 지났으면 문장은 맞은 채로 쓸모가 없어진다.
 * 여기 값들은 코어가 현재가 기준으로 다시 계산한 것이라, 둘이 어긋나는 순간을 잡는다.
 *
 * 조용히 있는 편을 기본으로 삼는다 — 계산할 것이 없으면 아무것도 그리지 않는다.
 */

const PERCENT = 100;

/** 위험 순으로 정렬된 경고. 가장 무거운 것 하나만 강조색을 받는다. */
type Severity = 'danger' | 'warn' | 'info';

const SEVERITY_STYLE: Record<Severity, string> = {
    danger: 'border-ui-danger/30 bg-ui-danger/10',
    warn: 'border-ui-warning/30 bg-ui-warning/10',
    info: 'border-secondary-700 bg-secondary-800/40',
};

// globals.css: 기본 ui-* 토큰은 그래픽용(3:1)이라 /10 배경 위 작은 글씨로 쓰면 4.5:1을
// 못 넘긴다. 글자는 -text 변종을 쓴다.
const SEVERITY_TEXT: Record<Severity, string> = {
    danger: 'text-ui-danger-text',
    warn: 'text-ui-warning-text',
    info: 'text-secondary-300',
};

interface Notice {
    severity: Severity;
    text: string;
}

function formatRatio(ratio: number): string {
    return ratio.toFixed(2);
}

/**
 * 경고 목록을 만든다. 심각한 것이 앞이다.
 *
 * `riskRewardAtCurrent`의 `0`과 `null`은 다른 뜻이라 다르게 다룬다 — `0`은 "목표가
 * 남지 않았다"는 사실이고 `null`은 "잴 수 없다"이다. 후자는 경고가 아니다.
 */
function buildNotices(planCheck: PlanCheck): Notice[] {
    const notices: Notice[] = [];
    const { currentPrice, entryZoneTop, riskRewardAtCurrent } = planCheck;

    if (planCheck.belowStopLoss) {
        notices.push({
            severity: 'danger',
            text: '현재가가 손절가 아래로 내려갔어요. 이 계획은 이미 무효예요.',
        });
    }

    if (riskRewardAtCurrent === 0) {
        notices.push({
            severity: 'danger',
            text: '현재가 위에 남은 목표가가 없어요. 지금 들어가면 노릴 수익 구간이 없어요.',
        });
    } else if (riskRewardAtCurrent !== null && riskRewardAtCurrent < 1) {
        notices.push({
            severity: 'warn',
            text: `현재가 기준 손익비가 ${formatRatio(riskRewardAtCurrent)}예요. 감수하는 손실이 노리는 수익보다 커요.`,
        });
    }

    if (planCheck.exceedsEntryZone && entryZoneTop !== null) {
        const over = ((currentPrice / entryZoneTop - 1) * PERCENT).toFixed(1);
        notices.push({
            severity: 'warn',
            text: `현재가가 권장 진입 구간보다 ${over}% 높아요. 이 계획은 눌림을 기다리는 것을 전제로 해요.`,
        });
    }

    return notices;
}

interface PlanCheckBlockProps {
    planCheck: PlanCheck | undefined;
}

export function PlanCheckBlock({ planCheck }: PlanCheckBlockProps) {
    if (!planCheck) return null;

    const notices = buildNotices(planCheck);
    const { riskRewardAtEntry, riskRewardAtCurrent } = planCheck;
    const hasRatios =
        riskRewardAtEntry !== null || riskRewardAtCurrent !== null;

    // 경고도 없고 잴 수 있는 비율도 없으면 아무 말도 하지 않는다.
    if (notices.length === 0 && !hasRatios) return null;

    const severity: Severity = notices[0]?.severity ?? 'info';

    return (
        <section
            className={cn(
                'mt-1 flex flex-col gap-1 rounded-md border px-3 py-2',
                SEVERITY_STYLE[severity]
            )}
        >
            <header className="flex items-center">
                <span className="text-[10px] font-semibold tracking-wide text-secondary-400 uppercase">
                    현재가 기준 검산
                </span>
                <InfoTooltip>
                    <div className="text-secondary-300">
                        <p>
                            위 매매 전략의 손익비는 AI가 제안한 진입가를
                            기준으로 쓴 것이에요.
                        </p>
                        <p>
                            여기 값은 같은 손절가·목표가를{' '}
                            <strong>지금 가격</strong>
                            에 놓고 다시 계산한 것이라, 가격이 이미 움직였을 때
                            둘이 달라져요.
                        </p>
                    </div>
                </InfoTooltip>
            </header>

            {notices.map(notice => (
                <p
                    key={notice.text}
                    className={cn('text-sm', SEVERITY_TEXT[notice.severity])}
                >
                    {notice.text}
                </p>
            ))}

            {hasRatios && (
                <p className="text-xs text-secondary-400">
                    손익비 — 계획 진입가 기준{' '}
                    {riskRewardAtEntry === null
                        ? '계산 불가'
                        : formatRatio(riskRewardAtEntry)}
                    {' / '}
                    현재가 기준{' '}
                    {riskRewardAtCurrent === null
                        ? '계산 불가'
                        : formatRatio(riskRewardAtCurrent)}
                </p>
            )}
        </section>
    );
}
