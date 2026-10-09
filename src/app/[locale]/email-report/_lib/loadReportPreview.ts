import 'server-only';
import { selectReportSymbols } from '@/entities/email-report/lib/selectReportSymbols';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { DrizzleWatchlistRepository } from '@/entities/watchlist/api';
import type { ReportSymbolsPreviewData } from '@/features/email-report-settings/ui/ReportSymbolsPreview';
import { getDatabaseClient } from '@/shared/db/client';

/**
 * 미리보기 데이터 — 배치와 **같은** `selectReportSymbols`로 고른다. 조회 실패는 `null`로
 * degrade해 설정 폼은 그대로 두고 미리보기만 안내로 바꾼다(SA-4: 로그 후 degrade).
 */
export async function loadReportPreview(
    userId: string
): Promise<ReportSymbolsPreviewData | null> {
    try {
        const { db } = getDatabaseClient();
        const [holdings, watchlist] = await Promise.all([
            new DrizzlePortfolioRepository(db).findByUser(userId),
            new DrizzleWatchlistRepository(db).findByUser(userId),
        ]);
        const names = new Map(
            [...watchlist, ...holdings]
                .filter(row => row.companyName != null)
                .map(row => [row.symbol, row.companyName] as const)
        );
        const selection = selectReportSymbols({ holdings, watchlist });
        const chip = (symbol: string) => ({
            symbol,
            name: names.get(symbol) ?? null,
        });
        return {
            full: selection.full.map(chip),
            brief: selection.brief.map(chip),
        };
    } catch (error) {
        console.error('[email-report] preview load failed', error);
        return null;
    }
}
