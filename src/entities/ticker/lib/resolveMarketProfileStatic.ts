import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { getAssetInfoStatic } from './getAssetInfoStatic';
import { marketProfileForAssetInfo } from './resolveMarketProfile';

/**
 * `resolveMarketProfile`과 같은 매핑을 `getAssetInfoStatic`(Next data cache, 24h,
 * `symbol:` 태그)으로 읽는다. `[symbol]` 레이아웃이 이미 읽은 엔트리라, 페이지 로드 직후의
 * 차트 재조회가 `asset_translations` 조회 대신 캐시 hit이 된다.
 *
 * 별도 파일인 이유: `resolveMarketProfile`은 여러 서버 경로·테스트가 import하고 mock한다.
 * 같은 파일에 두면 그 소비자 전부가 `next/cache`·`'use server'` 액션 체인을 함께 끌어온다.
 *
 * **알려진 실패 모드 — 새 크립토 자산이 최대 24h 동안 us-equity 세션으로 처리된다.**
 * 이 엔트리는 24h TTL 또는 `revalidateTag('symbol:<TICKER>')`로만 갱신되는데, 자산을 추가하는
 * 경로(`scripts/seed-crypto-assets.ts` 등 수동 시드, `crypto_assets` upsert)는 그 태그를 **부르지
 * 않는다**(2026-10 확인). 그래서 추가 전에 한 번이라도 조회돼 `null`(→ 기본 `us-equity`)로 캐시된
 * 심볼은, 추가 뒤에도 TTL이 끝날 때까지 차트 재조회가 미국 정규장 세션 스펙으로 봉을 읽는다
 * (24/7 봉이 장 시간 기준으로 잘리거나 비어 보일 수 있다). 페이지 렌더(`[symbol]` 레이아웃)도 같은
 * 엔트리를 읽으므로 이 액션만 어긋나는 일은 없다 — 창은 페이지와 같다. 즉시 바로잡으려면 자산 추가 후
 * `revalidateTag('symbol:<TICKER>', 'max')`를 부른다. FMP 크립토 목록 폴백
 * (`fmpCryptoMembership`)이 처음부터 잡는 심볼은 이 창이 생기지 않는다.
 *
 * 인프라 실패는 캐시되지 않고 던진다(캐시 없는 변형과 같다).
 */
export async function resolveMarketProfileStatic(
    symbol: string
): Promise<MarketProfileId> {
    return marketProfileForAssetInfo(await getAssetInfoStatic(symbol));
}
