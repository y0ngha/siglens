import 'server-only';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { getYahooAnalystSummary } from '@/shared/api/yahoo/yahooAnalystSource';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { buildAnalystViews } from '../lib/buildAnalystViews';
import type { AnalystAction } from '../model';

/**
 * 증권사별 등급·목표가 변경 이력(Yahoo `upgradeDowngradeHistory`, 최신순). 뉴스 탭의 애널리스트 의견 목록이
 * 목표가 변화(이전 → 현재)를 함께 보여 주려고 읽는다. FMP는 부르지 않는다 — 목표가 컨센서스가 필요 없는 호출이다.
 *
 * **`staticSymbolCache` 로더 안에서만** 부른다(렌더 중 캐시 밖 I/O는 ISR을 동적으로 뒤집는다).
 * - 한국 종목·E2E는 `null`(이력 모듈이 없거나 네트워크에 나가지 않는다) — 호출부가 기존 등급 목록을 쓴다.
 * - Yahoo가 실패하면 던진다: 결과가 캐시되므로 일시 장애의 "이력 없음"이 굳으면 안 된다.
 * - Yahoo가 이 심볼을 서비스하지 않으면(ETF 등) 빈 배열 — 실패가 아니다.
 */
export async function getAnalystActionHistory(
    symbol: string
): Promise<AnalystAction[] | null> {
    if (isKrEquitySymbol(symbol) || isE2EFakeMode()) return null;
    const yahoo = await getYahooAnalystSummary(symbol, {
        includeActions: true,
    });
    if (yahoo === null)
        throw new Error(`Yahoo analyst history unavailable for ${symbol}`);
    return buildAnalystViews({
        symbol,
        now: new Date(),
        yahoo,
        fmp: null,
        fmpFailed: false,
        includeActions: true,
        includeEarnings: false,
    }).actions.rows;
}
