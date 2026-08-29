import { describe, expect, it } from 'vitest';
import { statementColumnLabel } from '../statementColumnLabel';

describe('statementColumnLabel', () => {
    it('연간 행은 기존 표기(회계연도)를 그대로 쓴다 — 화면이 바뀌면 안 된다', () => {
        expect(statementColumnLabel({ fiscalYear: '2025', period: 'FY' })).toBe(
            '2025'
        );
    });

    it('period가 비어 있어도 회계연도로 떨어진다', () => {
        expect(statementColumnLabel({ fiscalYear: '2025', period: '' })).toBe(
            '2025'
        );
        expect(statementColumnLabel({ fiscalYear: '2025', period: '  ' })).toBe(
            '2025'
        );
    });

    it('분기 행은 분기를 덧붙인다 — 원래 알 수 없던 정보다', () => {
        expect(statementColumnLabel({ fiscalYear: '2025', period: 'Q3' })).toBe(
            '2025 Q3'
        );
    });

    /*
     * 이 테스트가 이 파일의 존재 이유다.
     *
     * 라벨은 `StatementTable`의 `key={col}`과 `FinancialTrendChart`의 `key={p}`로
     * 그대로 흘러가므로, 한 화면 안에서 유일하지 않으면 React가 노드를 잘못
     * 재사용한다. 실제로 `fiscalYear`만 쓰던 시절 연간↔분기 토글에서 컬럼이
     * 5 → 8 → 10 → 15로 늘고 분기 수치가 연간 칸에 섞였다.
     */
    it('같은 회계연도의 분기 4개가 서로 다른 라벨을 갖는다 (React key 유일성)', () => {
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map(period =>
            statementColumnLabel({ fiscalYear: '2025', period })
        );
        expect(new Set(quarters).size).toBe(4);
    });

    it('연간·분기가 섞인 행 집합에서도 라벨이 전부 유일하다', () => {
        const rows = [
            { fiscalYear: '2024', period: 'Q4' },
            { fiscalYear: '2025', period: 'Q1' },
            { fiscalYear: '2025', period: 'Q2' },
            { fiscalYear: '2025', period: 'Q3' },
            { fiscalYear: '2025', period: 'Q4' },
            { fiscalYear: '2026', period: 'Q1' },
        ];
        const labels = rows.map(statementColumnLabel);
        expect(new Set(labels).size).toBe(rows.length);
    });

    it('대소문자가 달라도 FY는 연간으로 본다', () => {
        expect(statementColumnLabel({ fiscalYear: '2025', period: 'fy' })).toBe(
            '2025'
        );
    });
});
