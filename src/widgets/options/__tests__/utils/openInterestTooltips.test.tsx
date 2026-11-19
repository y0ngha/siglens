import { render, screen } from '@testing-library/react';
import {
    CallOpenInterestTooltip,
    OpenInterestTooltip,
    PutOpenInterestTooltip,
} from '@/widgets/options/utils/openInterestTooltips';

describe('openInterestTooltips', () => {
    it('renders OpenInterestTooltip', () => {
        render(<>{OpenInterestTooltip}</>);
        expect(screen.getByText(/살아있는/)).toBeInTheDocument();
    });

    it('renders CallOpenInterestTooltip', () => {
        render(<>{CallOpenInterestTooltip}</>);
        expect(
            screen.getByText(/콜\(상승\) 옵션을 산 사람/)
        ).toBeInTheDocument();
    });

    it('renders PutOpenInterestTooltip', () => {
        render(<>{PutOpenInterestTooltip}</>);
        expect(
            screen.getByText(/풋\(하락\) 옵션을 산 사람/)
        ).toBeInTheDocument();
    });
});
