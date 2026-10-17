import { warnWithDetail } from '@/shared/lib/warnWithDetail';
import { COMPOSITE_KEY_SEPARATOR, dedupeByKey } from '../lib/dedupeByKey';

/** 중복을 줄였을 때 경고를 남기는 로거 — 수집 cron `createDeps`가 주입하는 `log`와 같은 모양이다. */
export type UpsertLog = (message: string, detail?: unknown) => void;

/**
 * upsert 직전, 청크로 자르기 전에 충돌 대상 키가 같은 행을 하나로 줄이고(뒤 행이 이긴다, `dedupeByKey`) 줄였으면 한 번 경고를
 * 남긴다(`log`, 기본 `warnWithDetail`). 한 문장 안의 중복 키는 Postgres 21000으로 그 실행의 쓰기 전체를 실패시키므로, 생산자(파서)가 이미 중복을 지우는
 * 경로라도 저장소가 스스로 지킨다 — 생산자 쪽 보장은 다른 파일의 불변식이라 깨져도 여기서는 보이지 않는다.
 */
export function uniqueForUpsert<T>(
    table: string,
    rows: readonly T[],
    keyOf: (row: T) => string,
    log: UpsertLog = warnWithDetail
): T[] {
    const { rows: unique, dropped, exampleKeys } = dedupeByKey(rows, keyOf);
    if (dropped > 0) {
        log(
            `[investor-flows] ${table}: dropped ${dropped} duplicate-key row(s) from one upsert (last row kept), e.g.`,
            exampleKeys.map(key => key.split(COMPOSITE_KEY_SEPARATOR).join('|'))
        );
    }
    return unique;
}
