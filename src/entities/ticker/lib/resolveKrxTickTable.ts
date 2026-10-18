import 'server-only';
import type { KrxTickTable } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import {
    buildKrxTickTableCacheKey,
    KRX_TICK_TABLE_CACHE_TTL,
} from './cacheKeys';

/** yahoo가 ETF/ETN을 어떤 `quoteType`으로 부르든 상장지수상품 호가표('etp')를 쓴다. */
const ETP_QUOTE_TYPES: ReadonlySet<string> = new Set(['ETF', 'ETN']);

let providerPromise: Promise<{
    getQuoteTypeOrThrow(symbol: string): Promise<string | null>;
}> | null = null;

/**
 * provider 인스턴스를 모듈 레벨에서 1회만 만든다. 동적 import인 이유는
 * `krEquityQuoteName.ts`와 같다 — `YahooMarketProvider`는 server-only이고 Node 전용
 * 모듈(`yahoo-finance2`)을 끌고 온다.
 */
function getQuoteType(symbol: string): Promise<string | null> {
    providerPromise ??= import('@/shared/api/yahoo/YahooMarketProvider').then(
        m => new m.YahooMarketProvider()
    );
    return providerPromise.then(p => p.getQuoteTypeOrThrow(symbol));
}

/** yahoo 조회 시도 횟수 — 일시 오류 한 번으로 실패를 확정하지 않는다. */
const QUOTE_TYPE_ATTEMPTS = 2;

async function fetchKrxTickTable(symbol: string): Promise<KrxTickTable> {
    let lastError: unknown;
    for (let attempt = 0; attempt < QUOTE_TYPE_ATTEMPTS; attempt++) {
        try {
            const quoteType = await getQuoteType(symbol);
            if (quoteType === null) {
                throw new Error('yahoo returned no quoteType');
            }
            return ETP_QUOTE_TYPES.has(quoteType.toUpperCase())
                ? 'etp'
                : 'share';
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

/**
 * 심볼 하나가 쓰는 KRX 호가 단위 표를 정한다. KRX ETF/ETN은 2,000원 미만 1원·이상 5원
 * 단위('etp'), 주식은 더 거친 주식 표('share')다.
 *
 * **모든 진입점이 같은 표를 넘겨야 한다.** core는 `krxTickTable`을 분석 캐시 키에 넣지
 * 않는다(`currency`와 같은 계약 — 심볼이 평생 하나를 고정한다). 진입점마다 다른 표를
 * 넘기면 틀린 표로 반올림된 가격이 TTL이 끝날 때까지 공유 키에 남는다. 그래서 입력은
 * 심볼 하나뿐이고, 이름 휴리스틱(`classifyAsset`)은 쓰지 않는다 — yahoo 영문명과 한글
 * 큐레이션명이 경로마다 달라 판정이 갈린다.
 *
 * **판정하지 못하면 던진다.** yahoo를 두 번 불러도 실패하면 'share'로 추측하지 않고
 * 오류를 낸다 — 추측한 'share'로 ETF 분석을 만들면 그 결과가 공유 캐시 키에 TTL 내내
 * 남는다. 한국 종목은 봉도 yahoo에서 받으므로 yahoo가 안 될 때는 어차피 분석이 실패한다.
 * 실패는 캐시하지 않는다(`getOrSetCache`는 성공한 결과만 저장). 캐시에 쓰지 않는 화면
 * 표시는 {@link resolveKrxTickTableForDisplay}를 쓴다.
 *
 * 한국 종목이 아니면 I/O 없이 'share'(표는 KRW 가격에만 의미가 있다). E2E는 외부
 * 네트워크를 타지 않으므로 마찬가지로 'share'다.
 */
export async function resolveKrxTickTable(
    symbol: string
): Promise<KrxTickTable> {
    if (!isKrEquitySymbol(symbol) || isE2E()) return 'share';
    return getOrSetCache<KrxTickTable>(
        buildKrxTickTableCacheKey(symbol),
        KRX_TICK_TABLE_CACHE_TTL,
        () => fetchKrxTickTable(symbol)
    );
}

/**
 * 화면 표시용 — 판정에 실패하면 주식 표('share')로 떨어진다. 분석 결과를 만들거나 캐시하지
 * 않는 곳(종목·공유 페이지의 가격 반올림 표시)에서만 쓴다. 틀려도 그 렌더의 표시 자릿수만
 * 어긋나고, 분석 캐시는 건드리지 않는다.
 */
export async function resolveKrxTickTableForDisplay(
    symbol: string
): Promise<KrxTickTable> {
    try {
        return await resolveKrxTickTable(symbol);
    } catch (error) {
        console.warn(
            '[resolveKrxTickTable] quoteType lookup failed, displaying with the share table:',
            symbol,
            error
        );
        return 'share';
    }
}
