/**
 * 재무제표 표의 입력 타입 — 섹션이 행을 만들고 표 하위 컴포넌트가 읽는다.
 */
import type { ReactNode } from 'react';
import type { StatementFormat } from './statementFormat';

/** 표의 지표 한 행. */
export interface StatementTableRowData {
    labelKo: string;
    tooltip?: ReactNode;
    /**
     * `columns`에 정렬된 값. index 0이 `columns[0]`에 대응하며, 행은 과거→최신(좌→우) 순서로
     * 넘긴다.
     */
    values: (number | null)[];
    format?: StatementFormat;
    /**
     * `true`(기본)면 양수는 성공색, 음수는 위험색 — 손익·마진·성장처럼 부호가 곧 좋고 나쁨인
     * 행용이다. 총자산·총부채·자본·현금처럼 절대 규모가 좋고 나쁨이 아닌 행은 `false`로 꺼서
     * 부호와 무관하게 중립색을 쓴다.
     */
    colorize?: boolean;
}
