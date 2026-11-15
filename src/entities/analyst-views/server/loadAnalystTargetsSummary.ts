import 'server-only';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { summarizeAnalystTargets } from '../lib/summarizeAnalystTargets';
import type { AnalystTargetsSummary } from '../model';
import { getAnalystViews } from './getAnalystViews';

/**
 * 펀더멘털 탭 "미래 방향" 카드의 Yahoo 목표가 줄. **`staticSymbolCache`(24h) 로더 안에서만** 부른다 —
 * 바깥에서 부르면 렌더 중 캐시 밖 I/O가 ISR을 동적으로 뒤집는다.
 *
 * Yahoo가 실패한 호출은 던진다: 이 로더의 결과는 하루 동안 캐시되므로 일시 장애의 `null`이 굳으면 안 되고,
 * 호출부(`loadOptionalSection`)가 던짐을 받아 경고만 남기고 그 줄 없이 렌더한다(revalidate는 낮추지 않는다). "Yahoo에 데이터가 없음"(ETF 등)은
 * 실패가 아니라 정상적인 `null`이다. 한국 종목은 프로바이더가 이미 Yahoo라 나란히 보일 것이 없어
 * 호출하지 않는다.
 */
export async function loadAnalystTargetsSummary(
    symbol: string
): Promise<AnalystTargetsSummary | null> {
    // E2E는 네트워크에 나가지 않는다 — Yahoo 소스가 `null`을 돌려 영구 degraded 분기를 타지 않게 건너뛴다.
    if (isKrEquitySymbol(symbol) || isE2EFakeMode()) return null;
    const views = await getAnalystViews(symbol, { detail: 'lite' });
    if (views.degraded.includes('yahoo')) {
        throw new Error(`Yahoo analyst targets unavailable for ${symbol}`);
    }
    return summarizeAnalystTargets(views);
}
