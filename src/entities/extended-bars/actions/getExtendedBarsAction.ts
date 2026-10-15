'use server';

import {
    type Bar,
    type Timeframe,
    isTimeframeAllowed,
} from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { resolveCallerTier } from '@/entities/auth/lib/resolveCallerTier';
import { loadExtendedBars } from '../api';
import { parseExtendedBarsRequest } from '../lib/extendedBarsRequest';

/**
 * 프리·애프터마켓 봉(정규장 밖 봉만, **표시 전용**). 던지지 않는다 — 어떤 실패든 `null`("그리지
 * 않는다")로 접는다(SERVER.md#SA-1). 지표는 담지 않는다: 차트는 지표를 정규장 봉(`getBarsAction`)에서
 * 받고, 이 결과는 캔들·거래량 시리즈의 시간외 구간에만 얹는다.
 *
 * 게이트(어느 하나라도 걸리면 FMP 호출 없이 `null`):
 * 1. E2E.
 * 2. 입력 형식 — 심볼, 인트라데이 타임프레임(1Day는 `extended`를 무시하므로 받지 않는다).
 * 3. 호출자 티어가 그 타임프레임을 쓸 수 있는가(`getBarsAction`과 같은 규칙).
 * 4. us-equity 자산인가(`loadExtendedBars`).
 *
 * FMP 보호는 정규장 `getBarsAction`과 같은 층에 더 엄격한 입구를 더한 것이다. 정규장 액션에는 별도 rate limit이
 * 없고(티어 게이트 + 인스턴스 메모리·단일 비행 + provider Redis 캐시), 이 액션도 티어 게이트 + provider Redis 캐시
 * (history·tail TTL은 provider가 정한다; 같은 키의 동시 miss는 `getOrSetCache`가 한 번의 fetch로 접는다)다. 거기에 더해
 * 입력 형식·타임프레임 검증과 `getAssetInfoStatic`로 푼 us-equity 자산만 통과시키므로(정규장 액션은 모르는
 * 심볼도 us-equity로 폴백한다) 임의 문자열이 FMP 호출로 이어지지 않는다. 클라이언트 `humanInteracted` 게이트는
 * 정직한 클라이언트의 크롤러 비용 절감용이고 보안 경계가 아니다.
 *
 * 인자는 심볼·타임프레임뿐이고 회원 데이터를 만지지 않는다. 조회할 FMP 심볼은 서버가 푼 자산이 정한다
 * (`asset.fmpSymbol ?? ticker`) — 클라이언트 FMP 심볼 인자는 없다.
 */
export async function getExtendedBarsAction(
    symbol: string,
    timeframe: Timeframe
): Promise<Bar[] | null> {
    if (isE2E()) return null;
    try {
        const request = parseExtendedBarsRequest(symbol, timeframe);
        if (request === null) return null;
        const tier = await resolveCallerTier('getExtendedBarsAction');
        if (!isTimeframeAllowed(tier, request.timeframe)) return null;
        return await loadExtendedBars(request.ticker, request.timeframe);
    } catch (error) {
        // 프로바이더 오류 객체는 심볼·URL을 담을 수 있어 이름만 남긴다.
        console.error('[getExtendedBarsAction] degraded to null:', {
            errorName: error instanceof Error ? error.name : 'unknown',
        });
        return null;
    }
}
