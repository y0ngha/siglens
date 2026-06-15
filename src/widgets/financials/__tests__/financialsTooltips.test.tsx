import { render, screen } from '@testing-library/react';
import {
    FcfTooltip,
    NetDebtTooltip,
    AccrualsTooltip,
    CapExTooltip,
    FcfMarginTooltip,
    GrossMarginTooltip,
} from '@/widgets/financials/financialsTooltips';

describe('financialsTooltips', () => {
    it('FcfTooltip renders FCF explanation text', () => {
        render(<div>{FcfTooltip}</div>);
        expect(screen.getByText(/설비투자\(CapEx\)를 빼고/)).toBeDefined();
        expect(screen.getByText(/배당·자사주·빚 상환의 재원/)).toBeDefined();
    });

    it('NetDebtTooltip renders net debt explanation text', () => {
        render(<div>{NetDebtTooltip}</div>);
        expect(screen.getByText(/총부채에서 보유 현금을 뺀 값/)).toBeDefined();
        expect(screen.getByText(/순현금/)).toBeDefined();
    });

    it('AccrualsTooltip renders accruals quality explanation text', () => {
        render(<div>{AccrualsTooltip}</div>);
        expect(
            screen.getByText(/장부상 순이익이 실제 영업현금흐름으로/)
        ).toBeDefined();
        expect(screen.getByText(/이익의 질이 좋다/)).toBeDefined();
    });

    it('CapExTooltip renders capital expenditure explanation text', () => {
        render(<div>{CapExTooltip}</div>);
        expect(
            screen.getByText(/공장·설비처럼 미래를 위해 투자한 돈/)
        ).toBeDefined();
        expect(screen.getByText(/성장 투자로 봐요/)).toBeDefined();
    });

    it('FcfMarginTooltip renders FCF margin explanation text', () => {
        render(<div>{FcfMarginTooltip}</div>);
        expect(
            screen.getByText(/매출 100원당 잉여현금흐름이 몇 원/)
        ).toBeDefined();
        expect(screen.getByText(/매출을 현금으로 잘 바꾼다/)).toBeDefined();
    });

    it('GrossMarginTooltip renders gross margin explanation text', () => {
        render(<div>{GrossMarginTooltip}</div>);
        expect(
            screen.getByText(/매출에서 원가를 뺀 매출총이익이 매출의/)
        ).toBeDefined();
        expect(screen.getByText(/기본 수익성이 좋다/)).toBeDefined();
    });
});
