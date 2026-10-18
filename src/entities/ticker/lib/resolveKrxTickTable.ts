import 'server-only';
/**
 * `lib/`의 순수 함수 규칙(`src/entities/CLAUDE.md#EN-1`)의 예외다 — yahoo 조회와 캐시를 직접
 * 한다. 같은 디렉터리의 `resolveMarketProfile.ts`·`krEquityQuoteName.ts`와 같은 이유다: 이 판정은
 * 다른 entity(`entities/analysis`)와 app 라우트가 함께 쓰는데, server-only `api.ts`는 같은 entity나
 * app 레이어에서만 import할 수 있어 거기 둘 수 없다.
 */
import { unstable_cache } from 'next/cache';
import type { KrxTickTable } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { loadYahooProvider } from '@/shared/api/yahoo/lazyYahooProvider';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { withRetry } from '@/shared/lib/withRetry';
import {
    buildKrxTickTableCacheKey,
    KRX_TICK_TABLE_CACHE_TTL,
} from './cacheKeys';

/** yahoo가 ETF/ETN을 어떤 `quoteType`으로 부르든 상장지수상품 호가표('etp')를 쓴다. */
const ETP_QUOTE_TYPES: ReadonlySet<string> = new Set(['ETF', 'ETN']);

/**
 * 일시 오류 한 번으로 실패를 확정하지 않는다 — 한 번 더 시도한 뒤에도 실패하면 던진다
 * (`resolveKrxTickTable`).
 */
const QUOTE_TYPE_RETRY = {
    maxRetries: 1,
    baseDelayMs: 200,
    isRetryable: () => true,
} as const;

function fetchKrxTickTable(symbol: string): Promise<KrxTickTable> {
    return withRetry(async () => {
        const quoteType = await loadYahooProvider().then(p =>
            p.getQuoteTypeOrThrow(symbol)
        );
        if (quoteType === null) {
            throw new Error('yahoo returned no quoteType');
        }
        return ETP_QUOTE_TYPES.has(quoteType.toUpperCase()) ? 'etp' : 'share';
    }, QUOTE_TYPE_RETRY);
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
 * **판정하지 못하면 던진다.** yahoo를 한 번 더 불러도 실패하면 'share'로 추측하지 않고
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
 * 렌더(정적·ISR) 경로용 — {@link resolveKrxTickTable}을 Next data cache로 감싼다.
 *
 * 종목·공유 페이지는 정적 생성/ISR로 렌더된다. 그 렌더 안에서 `getOrSetCache`가 Upstash에
 * no-store fetch를 보내면 Next가 `DYNAMIC_SERVER_USAGE`를 던지고, `getOrSetCache`는 그것을
 * Redis 장애로 오인해 `get/set failed`를 찍는다(v0.108.0 배포 직후 KR 종목 재생성 20건이
 * P2 알람을 울렸다). `peekAnalysisStatic`과 같은 해법으로 데이터 호출 자체를 `unstable_cache`로
 * 정적화한다. 실패(throw)는 Next가 저장하지 않으므로 "판정 못 하면 캐시하지 않는다" 계약은
 * 그대로다.
 *
 * 한국 종목이 아니거나 E2E면 엔트리를 만들지 않고 바로 'share'다(미국 종목마다 데이터 캐시
 * 항목이 생기지 않게). revalidate는 Redis TTL과 같은 30일 — 차트 라우트의 선언 revalidate(6h)보다
 * 길어 라우트 TTL을 줄이지 않는다.
 *
 * `unstable_cache`는 콜백 소스(`fn.toString()`)도 키에 섞는다. 이 키는 콜백이 이 한 곳이라는
 * 전제로 성립하므로, 다른 모양의 콜백으로 같은 키를 쓰는 호출부를 추가하지 않는다(엔트리가 갈라진다).
 */
function resolveKrxTickTableStatic(symbol: string): Promise<KrxTickTable> {
    if (!isKrEquitySymbol(symbol) || isE2E()) return Promise.resolve('share');
    const upper = symbol.toUpperCase();
    return unstable_cache(
        () => resolveKrxTickTable(upper),
        ['krx-tick-table-static-v1', upper],
        { revalidate: KRX_TICK_TABLE_CACHE_TTL, tags: [`symbol:${upper}`] }
    )();
}

/**
 * 화면 표시용 — 판정에 실패하면 주식 표('share')로 떨어진다. 분석 결과를 만들거나 캐시하지
 * 않는 곳(종목·공유 페이지의 가격 반올림 표시)에서만 쓴다. 틀려도 그 렌더의 표시 자릿수만
 * 어긋나고, 분석 캐시는 건드리지 않는다. 렌더 경로에서 부르므로
 * {@link resolveKrxTickTableStatic}을 거친다.
 *
 * **`DYNAMIC_SERVER_USAGE`는 되던진다** — 실패가 아니라 Next의 제어 흐름 신호라, 'share'로
 * 삼키면 의도한 bail-out을 막고 틀린 표를 정적 HTML에 굳힌다(`isDynamicServerError` JSDoc).
 */
export async function resolveKrxTickTableForDisplay(
    symbol: string
): Promise<KrxTickTable> {
    try {
        return await resolveKrxTickTableStatic(symbol);
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        console.warn(
            '[resolveKrxTickTable] quoteType lookup failed, displaying with the share table:',
            symbol,
            error
        );
        return 'share';
    }
}
