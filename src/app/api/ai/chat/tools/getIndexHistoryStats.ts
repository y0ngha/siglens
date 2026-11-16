import 'server-only';
import {
    AGENT_HISTORY_INDICES,
    computeIndexHistoryStats,
    type AgentHistoryIndex,
} from '@y0ngha/siglens-core';
import { loadIndexMonthEnds } from '@/entities/index-history/server/loadIndexMonthEnds';
import type { ToolExecutor } from '@/app/api/ai/chat/tools/chatTools';
import { logToolDegrade } from './logToolDegrade';

const TOOL = 'get_index_history_stats';
const SOURCE = 'SIGLENS index history (month-end closes)';

function isHistoryIndex(value: unknown): value is AgentHistoryIndex {
    return AGENT_HISTORY_INDICES.some(index => index === value);
}

/**
 * 지수의 장기 통계(core `computeIndexHistoryStats`): 연간 수익률·월별 계절성·(미국) 대통령 임기 주기·중간선거 뒤
 * 12개월. 월말 종가·진행 중인 달·임기 주기 여부는 엔티티가 지수별로 정한다. 로드 실패는 `provider_failed`다.
 * 절대 던지지 않는다.
 */
export const getIndexHistoryStatsTool: ToolExecutor = async args => {
    const index = args.index;
    if (!isHistoryIndex(index)) return { error: 'invalid_args' };
    const now = new Date();
    const loaded = await loadIndexMonthEnds(index, now).catch(
        (error: unknown) => {
            logToolDegrade(TOOL, 'month-end closes', error);
            return null;
        }
    );
    if (loaded === null)
        return { index, available: false, reason: 'provider_failed' };
    const stats = computeIndexHistoryStats(loaded.monthEnds, {
        usCycle: loaded.usCycle,
        currentMonth: loaded.currentMonth,
    });
    if (stats === null)
        return { index, available: false, reason: 'provider_failed' };
    return {
        asOf: now.toISOString(),
        source: SOURCE,
        index,
        available: true,
        ...stats,
    };
};
