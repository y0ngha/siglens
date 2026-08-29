/**
 * Builds the column label for one statement row.
 *
 * 이 함수가 따로 존재하는 이유는 라벨이 **React key로도 쓰이기 때문**이다.
 * 네 섹션(손익계산서·재무상태표·현금흐름표·성장 분석)이 모두
 * `columns = displayRows.map(r => r.fiscalYear)`로 컬럼을 만들고, 그 문자열이
 * `StatementTable`의 `key={col}` / `key={columns[j]}`와 `FinancialTrendChart`의
 * `key={p}` / `key={`hit-${p}`}`로 그대로 흘러간다.
 *
 * `fiscalYear`는 분기 보기에서 유일하지 않다 — 2025 Q1~Q4가 전부 `"2025"`다.
 * 그 결과 두 가지가 동시에 터졌다(실측, AAPL 손익계산서):
 *
 *  1. 헤더가 `2024, 2025, 2025, 2025, 2025, 2026, 2026, 2026`으로 나와 어느
 *     칸이 어느 분기인지 알 수 없다.
 *  2. React가 중복 key로 노드를 잘못 재사용해, 연간↔분기를 오가면 컬럼이
 *     5 → 8 → 10 → 15로 계속 늘고 **분기 수치가 연간 칸에 섞인다**. 분기를
 *     눌렀다 연간으로 돌아오면 FY2025 매출이 실제 $416.2B가 아니라 Q 수치인
 *     $124.3B로 읽혔다.
 *
 * 그래서 라벨을 유일하게 만드는 것이 곧 key를 고치는 것이다 — `key=` 네 곳을
 * 따로 손보는 대신 출처 한 곳에서 해결한다.
 *
 * 연간 행(`period === 'FY'`)은 기존 표기 `"2025"`를 그대로 유지해 화면이
 * 바뀌지 않는다. 분기 행만 `"2025 Q3"`이 되며, 이는 원래 알 수 없던 정보를
 * 되살리는 것이다.
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
