import type { BacktestTrade } from '@y0ngha/siglens-core';
import type { ExitPathKey } from '@/entities/backtest-case/model';

/** 표시 순서 — 수익이 큰 경로부터, 급락 매수 규칙은 끝에. */
export const EXIT_PATH_ORDER: readonly ExitPathKey[] = [
    'tp1_tpFinal',
    'tp1_trailing',
    'sl1_tpFinal',
    'tp1_breakeven',
    'sl1_sl2',
    'selloff_recovered',
    'selloff_stopped',
    'other',
];

/**
 * 절반 A·B의 청산 사유 조합 → 청산 경로. 시뮬레이터 규칙상 A가 끝난 뒤의 B 손절은 A 결과에
 * 따라 갈린다: A 익절 뒤엔 `breakeven`(본전) 또는 `sl1`(본전보다 높게 갱신된 AI 손절가),
 * A 손절 뒤엔 `sl2`. 그래서 `tp1`+`sl1`은 "올라간 손절가에 걸린" 추적 청산이다.
 */
export function exitPathOf(trade: BacktestTrade): ExitPathKey {
    const [a, b] = trade.legs;
    if (trade.entryType === 'enter_selloff') {
        if (a.reason === 'selloff_stop') return 'selloff_stopped';
        if (a.reason === 'selloff_ma5' || a.reason === 'selloff_time') {
            return 'selloff_recovered';
        }
        return 'other'; // 기간 말 보유·최대 보유 기간 만료는 회복 청산이 아니다.
    }
    if (a.reason === 'tp1') {
        if (b.reason === 'tp_final') return 'tp1_tpFinal';
        if (b.reason === 'sl1') return 'tp1_trailing';
        if (b.reason === 'breakeven') return 'tp1_breakeven';
    }
    if (a.reason === 'sl1') {
        if (b.reason === 'tp_final') return 'sl1_tpFinal';
        if (b.reason === 'sl2') return 'sl1_sl2';
    }
    return 'other';
}
