import 'server-only';
import type { MarketDataProvider, PositionBucket } from '@y0ngha/siglens-core';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { logActionError } from '@/shared/lib/logActionError';
import { getDatabaseClient } from '@/shared/db/client';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { resolvePositionBucket } from '@/shared/lib/byokGate';

export interface ResolveHoldingPositionBucketInput {
    readonly userId: string | null;
    readonly tier: Parameters<typeof resolvePositionBucket>[0];
    readonly symbol: string;
    /**
     * 호출자가 이미 해석한 시세 조회용 심볼(asset info의 `fmpSymbol`). 없으면 보유 행에
     * 저장된 `fmpSymbol`, 그것도 없으면 `symbol`로 조회한다.
     */
    readonly quoteSymbol?: string;
    readonly marketDataProvider: Pick<MarketDataProvider, 'getQuote'>;
    /** 실패 로그 태그 — 호출 지점 구분용. */
    readonly logTag: string;
}

/**
 * 개인화 분석 캐시 키용 포지션 버킷: 사용자의 보유(평단) vs 현재가.
 *
 * 분석 SSE 라우트(캐시를 **쓰는** 쪽)와 에이전트 `get_cached_analysis`(같은 캐시를
 * **읽는** 쪽)가 이 함수 하나를 공유한다. 두 쪽이 버킷을 다르게 계산하면(조회 심볼
 * 정규화·시세 심볼 선택이 갈라지면) 에이전트가 사용자의 개인화 분석을 영영 못 찾는다.
 *
 * 어떤 실패든 `undefined`(버킷 없음 = 공용 분석)로 degrade한다 — 보유/시세 조회
 * 오류가 본 분석을 막으면 안 된다. 로그는 에러 이름/코드만 남긴다(Drizzle 에러의
 * `.message`는 바인딩 파라미터를 품는다).
 */
export async function resolveHoldingPositionBucket({
    userId,
    tier,
    symbol,
    quoteSymbol,
    marketDataProvider,
    logTag,
}: ResolveHoldingPositionBucketInput): Promise<PositionBucket | undefined> {
    if (tier === 'free' || userId === null) return undefined;
    try {
        const { db } = getDatabaseClient();
        // `portfolio_holdings.symbol`은 대문자 정규형으로 저장된다.
        const holding = await new DrizzlePortfolioRepository(
            db
        ).findByUserAndSymbol(userId, symbol.toUpperCase());
        if (holding === null) return undefined;
        // SSE 라우트에선 첫 바이트 전에 도는 조회라 침묵 한도 안에 있어야 한다 —
        // 상한은 `quoteWithTimeout`이 강제한다.
        const quote = await quoteWithTimeout(
            marketDataProvider,
            quoteSymbol ?? holding.fmpSymbol ?? symbol
        );
        return resolvePositionBucket(
            tier,
            Number(holding.averagePrice),
            quote?.price ?? null
        );
    } catch (error) {
        logActionError(logTag, error);
        return undefined;
    }
}
