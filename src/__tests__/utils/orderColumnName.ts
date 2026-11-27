import { renderSql } from '@/__tests__/utils/renderSql';

/**
 * drizzle `asc(col)`/`desc(col)` 노드를 `"컬럼 방향"` 문자열로 줄인다 — 이름만 보면
 * desc→asc 뮤테이션이 그대로 통과해 "앞이 최신"이라는 전제가 뒤집힌 채 상한 slice가
 * **가장 오래된** 행을 남긴다(감사: 라운드 4 P1). 렌더링된 SQL(`"t"."col" desc`)에서 읽는다.
 */
export function orderColumnName(node: unknown): string {
    const match = /"([^"]+)"\s+(asc|desc)$/.exec(renderSql(node).sql);
    return match ? `${match[1]} ${match[2]}` : '? ?';
}
