import type { KrxListedItem } from '@/shared/api/dataGoKr/krxListedInfoClient';
import type { KrxShareCounts } from './refreshShareCounts';

/** `YYYYMMDD` → `YYYY-MM-DD`. */
const toIsoDate = (basDt: string): string =>
    `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`;

/**
 * 같은 5자리 접두사를 쓰는 상장 종목들(보통주 + 우선주, 예: `009830` 한화솔루션 + `009835` 한화솔루션우)에서 한 회사의 KRX 상장주식수를 만든다.
 * 보통주는 이름이 가장 짧은 종목(같으면 코드가 `0`으로 끝나는 쪽)이고, 우선주는 그 이름으로 시작하는 나머지 종목이다. 기준일이 섞인
 * 목록이면 가장 늦은 날의 행만 쓴다. 보통주를 못 찾거나 상장주식수가 없으면 null.
 */
export function toKrxShareCounts(
    items: readonly KrxListedItem[]
): KrxShareCounts | null {
    const latest = items.reduce(
        (max, item) => (item.basDt > max ? item.basDt : max),
        ''
    );
    const day = items.filter(item => item.basDt === latest);
    const common = [...day].sort(
        (a, b) =>
            a.koreanName.length - b.koreanName.length ||
            Number(b.shortCode.endsWith('0')) -
                Number(a.shortCode.endsWith('0'))
    )[0];
    if (common === undefined || common.listedShares === null) return null;
    const preferred = day.filter(
        item =>
            item.shortCode !== common.shortCode &&
            item.listedShares !== null &&
            item.koreanName.startsWith(common.koreanName)
    );
    return {
        asOf: toIsoDate(latest),
        common: common.listedShares,
        preferred:
            preferred.length === 0
                ? null
                : preferred.reduce(
                      (sum, item) => sum + (item.listedShares ?? 0),
                      0
                  ),
    };
}
