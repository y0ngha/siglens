/**
 * 축 카드의 신호 칩 — 방향별 색과 종류별 번역 라벨.
 */
import { useTranslations } from 'next-intl';
import type { FinancialSignal } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SIGNAL_CHIP_CLASS, SIGNAL_LABEL_KEY } from '../../utils/signalDisplay';

interface SignalChipProps {
    signal: FinancialSignal;
}

/**
 * 라벨은 core가 주는 한국어 `labelKo`가 아니라 안정적인 `type`으로 번역을 찾는다.
 * `tSignal(SIGNAL_LABEL_KEY[...])`는 이 파일에서 번역자를 직접 호출해야 extract.mjs의 동적 키
 * 탐지가 `widgets.financials.signalType`을 이 라우트의 클라이언트 번들에 싣는다.
 */
export function SignalChip({ signal }: SignalChipProps) {
    const tSignal = useTranslations('widgets.financials.signalType');
    return (
        <span
            className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
                SIGNAL_CHIP_CLASS[signal.direction]
            )}
        >
            {tSignal(SIGNAL_LABEL_KEY[signal.type])}
        </span>
    );
}
