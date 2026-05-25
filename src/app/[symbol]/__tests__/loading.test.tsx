import { render, screen } from '@testing-library/react';
import SymbolLoading from '@/app/[symbol]/loading';

describe('SymbolLoading', () => {
    it('renders a loading message', () => {
        render(<SymbolLoading />);

        expect(screen.getByText('데이터 로딩 중…')).toBeInTheDocument();
    });
});
