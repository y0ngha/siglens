'use client';

import { type ReactNode } from 'react';

/** `StrikeBarSrTable`의 단일 행 타입. */
export interface StrikeBarSrTableRow {
    /** `key` prop으로 사용되는 고유 식별자. */
    key: string | number;
    /** 순서대로 렌더할 셀 내용. */
    cells: ReactNode[];
}

interface StrikeBarSrTableProps {
    /** <caption> 텍스트 — 스크린 리더에 표 목적을 설명한다. */
    caption: string;
    /** <thead> 컬럼 헤더 목록. */
    headers: string[];
    /** <tbody> 행 목록. 각 row는 고유 key와 렌더할 셀(cells)로 구성된다. */
    rows: StrikeBarSrTableRow[];
}

/**
 * Strike 바 차트 공용 sr-only 접근성 테이블.
 *
 * OpenInterestChart·StrikeVolumeChart 양쪽이 동일한 `<div className="sr-only">
 * <table>` 패턴을 복제하고 있어 여기로 추출한다. caption·헤더·행 데이터만
 * 차트별로 다르므로 props로 주입받는다.
 *
 * ## 왜 <table>이 아니라 <div>로 감싸는가
 * `<table>`은 `display: table`이라 `position: absolute`와 결합돼도 일부
 * 환경에서 normal flow에 잔재가 남아 페이지 height에 영향을 준다. `<div>`로
 * 감싸 absolute 컨텍스트를 분리한다.
 */
export function StrikeBarSrTable({
    caption,
    headers,
    rows,
}: StrikeBarSrTableProps) {
    return (
        <div className="sr-only">
            <table>
                <caption>{caption}</caption>
                <thead>
                    <tr>
                        {headers.map(header => (
                            <th key={header} scope="col">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.key}>
                            {row.cells.map((cell, i) => (
                                // 셀 순서가 고정돼 있어 index를 key로 사용해도 안전하다.
                                <td key={i}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
