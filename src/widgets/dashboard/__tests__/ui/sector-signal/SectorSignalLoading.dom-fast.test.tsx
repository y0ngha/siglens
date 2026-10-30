import { render } from '@testing-library/react';
import { SectorSignalLoading } from '@/widgets/dashboard/ui/sector-signal/SectorSignalLoading';

describe('SectorSignalLoading', () => {
    it('로딩 중임을 aria-busy로 알린다', () => {
        const { container } = render(<SectorSignalLoading />);
        expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    });

    it('자리 표시 블록은 스크린리더에서 숨긴다', () => {
        const { container } = render(<SectorSignalLoading />);
        expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });
});
