import type {
    BacktestEntryType,
    BacktestLegExitReason,
} from '@y0ngha/siglens-core';
import type { ExitPathKey } from '@/entities/backtest-case/model';

/**
 * 도메인 값 → 번역 키. 키는 리터럴이어야 `i18n:extract`가 보고(I18-16), 레코드는 키 리터럴
 * 유니온으로 묶어 오타가 컴파일 오류가 되게 한다(I18-17).
 */
export const ENTRY_TYPE_KEY = {
    enter_close: 'entryType.enter_close',
    enter_selloff: 'entryType.enter_selloff',
    wait_limit: 'entryType.wait_limit',
} as const satisfies Record<
    BacktestEntryType,
    `entryType.${BacktestEntryType}`
>;

export const LEG_REASON_KEY = {
    tp1: 'legReason.tp1',
    tp_final: 'legReason.tp_final',
    sl1: 'legReason.sl1',
    sl2: 'legReason.sl2',
    breakeven: 'legReason.breakeven',
    selloff_ma5: 'legReason.selloff_ma5',
    selloff_time: 'legReason.selloff_time',
    selloff_stop: 'legReason.selloff_stop',
    max_hold: 'legReason.max_hold',
    open: 'legReason.open',
} as const satisfies Record<
    BacktestLegExitReason,
    `legReason.${BacktestLegExitReason}`
>;

export const EXIT_PATH_KEY = {
    tp1_tpFinal: 'tp1_tpFinal',
    tp1_trailing: 'tp1_trailing',
    tp1_breakeven: 'tp1_breakeven',
    sl1_tpFinal: 'sl1_tpFinal',
    sl1_sl2: 'sl1_sl2',
    selloff_recovered: 'selloff_recovered',
    selloff_stopped: 'selloff_stopped',
    other: 'other',
} as const satisfies Record<ExitPathKey, ExitPathKey>;
