/**
 * 재무제표 컬럼 라벨 — 표 헤더와 React key를 한 곳에서 유일하게 만든다.
 */

/**
 * 결산 행 하나의 컬럼 라벨을 만든다.
 *
 * 라벨이 **React key로도 쓰이기 때문**에 따로 있다. 네 섹션이 모두
 * `displayRows.map(statementColumnLabel)`로 컬럼을 만들고, 그 문자열이 `StatementTable`의
 * `key={col}`과 `FinancialTrendChart`의 `key={p}`·`key={`hit-${p}`}`로 그대로 흘러간다.
 *
 * `fiscalYear`는 분기 보기에서 유일하지 않다 — 2025 Q1~Q4가 전부 `"2025"`다. 그대로 쓰면
 * 헤더에서 어느 칸이 어느 분기인지 알 수 없고, 중복 key 때문에 React가 노드를 잘못 재사용해
 * 연간↔분기를 오갈 때 분기 수치가 연간 칸에 섞인다. 그래서 라벨을 유일하게 만드는 것이 곧
 * key를 고치는 것이다.
 *
 * 연간 행(`period === 'FY'`)은 `"2025"` 그대로, 분기 행만 `"2025 Q3"`이 된다.
 */
export function statementColumnLabel(row: {
    fiscalYear: string;
    period: string;
}): string {
    const period = row.period.trim();
    if (period === '' || period.toUpperCase() === 'FY') {
        return row.fiscalYear;
    }
    return `${row.fiscalYear} ${period}`;
}
