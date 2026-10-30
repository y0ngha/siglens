import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import type { AssetTranslationRecord } from '@/shared/db/types';
import type { AssetInfo } from '@/shared/lib/types';
import { normalizeCompanyName } from './normalizeCompanyName';
import type { TickerDisplayName } from './koreanNameSearch';

/**
 * `asset_translations` 행을 AssetInfo로 바꾼다. FMP 표기가 정본 심볼과 다를 때만
 * `fmpSymbol`을 싣는다(미국 주식은 둘이 같고 지수 등에서 갈린다).
 */
export function recordToAssetInfo(record: AssetTranslationRecord): AssetInfo {
    return {
        symbol: record.symbol,
        name: record.name,
        koreanName: record.koreanName,
        ...(record.fmpSymbol !== record.symbol && {
            fmpSymbol: record.fmpSymbol,
        }),
    };
}

/**
 * 정본 한글명이 있으면 덮는다. **`getAssetInfo`의 모든 반환 경로가 이걸 거친다.**
 *
 * `asset_translations`의 한글명은 LLM이 종목 방문 시 lazy하게 채운 것이라 표기가
 * 흔들린다 — 2026-08-24 실측에서 `LAES`가 홈/대시보드/DB에서 각각 세알시큐리티/
 * SEALSQ/씰스큐로 세 갈래였다. 사람이 고른 표기가 있으면 그쪽이 이겨야 같은
 * 종목이 화면마다 다른 이름으로 보이지 않는다(`CANONICAL_KOREAN_NAMES` JSDoc).
 *
 * ⚠️ **DB 읽기 지점이 아니라 함수 출구에 둔다.** 반환 경로가 여럿(크립토 DB·
 * `asset_translations` DB·Redis 임시 항목·야후·FMP)이라 한 지점에만 덮으면 나머지
 * 경로로 나간 옛 이름이 그대로 남는다. 과거에는 Redis 캐시가 먼저 답해 즉시
 * 반환하는 경로(`if (cached) return cached`)가 있었고, DB 경로에만 덮었다가 로컬
 * 실증에서 제목이 하나도 안 바뀌는 것을 확인했다. 지금은 Redis가 1년 사본을 들지
 * 않지만, 출구에 두면 어느 경로로 왔든 같은 이름이 나가는 불변식이 경로가 늘어도
 * 유지된다.
 *
 * Redis에 쓰는 임시 항목(12시간)은 원본 그대로 둔다 — 캐시가 파생값을 들고 있으면
 * 정본 맵과 어긋날 수 있기 때문이다. 덕분에 맵을 고쳐도 무효화가 필요 없다.
 *
 * ⚠️ **그렇다고 배포 즉시 전 화면에 반영되는 건 아니다.** `getAssetInfoStatic`이
 * 결과를 `unstable_cache`(24h, S3 cache-handler라 배포를 넘어 살아남는다)로 다시
 * 감싸므로, 이미 방문된 `[symbol]` 라우트는 TTL이 끝나거나
 * `revalidateTag('symbol:<TICKER>')`를 부르기 전까지 옛 이름을 서빙한다.
 */
export function withCanonicalKoreanName(
    info: AssetInfo | null
): AssetInfo | null {
    if (info === null) return info;
    const canonical = CANONICAL_KOREAN_NAMES.get(info.symbol);
    return canonical === undefined ? info : { ...info, koreanName: canonical };
}

/**
 * `korean_tickers`에 저장된 한글명을 FMP 경로에서 재사용해도 되는지 판정한다.
 *
 * 티커 재할당·사명 변경으로 심볼이 다른 회사로 넘어가면 저장된 영문명과 FMP가 지금 돌려준
 * 영문명이 달라진다. 그대로 재사용하면 옛 회사의 한글명이 굳으므로, 정규화한 두 이름이
 * 다르면 재사용하지 않고 호출부가 `translateAndPersist`로 보내게 한다. 이미 FMP 이름을
 * 손에 쥔 경로라 추가 호출이 없다.
 *
 * 정본 심볼은 사람이 고른 이름이 이기므로 항상 재사용한다(`getTickerDisplayNames`가 이미
 * 정본을 입혀 돌려준다). 저장된 영문명이 없으면(행 없이 정본만 나온 경우) 비교 대상이
 * 없어 그대로 쓴다.
 */
export function reusableKoreanName(
    symbol: string,
    fmpName: string,
    stored: TickerDisplayName | undefined
): string | undefined {
    if (!stored?.koreanName) return undefined;
    if (CANONICAL_KOREAN_NAMES.has(symbol) || stored.name === null) {
        return stored.koreanName;
    }
    return normalizeCompanyName(stored.name) === normalizeCompanyName(fmpName)
        ? stored.koreanName
        : undefined;
}
