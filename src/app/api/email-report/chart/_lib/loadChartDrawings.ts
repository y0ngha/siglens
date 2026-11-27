import 'server-only';
import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import {
    narrowChartDrawings,
    type ChartDrawingSource,
} from '@/entities/analysis/lib/narrowChartDrawings';
import { getDatabaseClient } from '@/shared/db/client';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * - `ok`: 그릴 작도(`drawings`)가 있거나, 행이 없거나(보존 기간 경과) 읽은 내용에서 그릴 작도를 못 꺼낸 경우(`null`).
 *   이 답은 바뀌지 않는다 — 호출자가 작도 없는 이미지를 오래 캐시해도 된다.
 * - `failed`: 읽지 못했다(DB 오류). 곧 달라질 수 있어 호출자가 캐시하지 않는다.
 */
export type ChartDrawingsLoad =
    | { status: 'ok'; drawings: ChartDrawingSource | null }
    | { status: 'failed' };

/**
 * 메일이 URL에 박아 둔 분석(`generatedAt`)의 작도. 절대 던지지 않는다(작도는 부가 표시다).
 */
export async function loadChartDrawings(
    symbol: string,
    generatedAt: Date
): Promise<ChartDrawingsLoad> {
    try {
        const { db } = getDatabaseClient();
        const found = await new DrizzleAnalysisHistoryRepository(
            db
        ).findShareableAt({
            symbol,
            timeframe: '1Day',
            tab: 'technical',
            generatedAt,
        });
        if (found.status === 'failed') return { status: 'failed' };
        return {
            status: 'ok',
            drawings:
                found.status === 'found'
                    ? narrowChartDrawings(found.row.result)
                    : null,
        };
    } catch (error) {
        console.warn(
            `[email-report] chart drawings unavailable for ${symbol}`,
            redactDbErrorForLog(error)
        );
        return { status: 'failed' };
    }
}
