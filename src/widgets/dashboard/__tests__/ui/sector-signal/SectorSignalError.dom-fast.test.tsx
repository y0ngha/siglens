import { fireEvent, render, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { SectorSignalError } from '@/widgets/dashboard/ui/sector-signal/SectorSignalError';

describe('SectorSignalError', () => {
    it('실패 사실을 알림 역할로 알린다', () => {
        render(<SectorSignalError onRetry={vi.fn()} />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '섹터 신호를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
        );
    });

    it('다시 시도 버튼을 누르면 onRetry를 부른다', () => {
        const onRetry = vi.fn();
        render(<SectorSignalError onRetry={onRetry} />);
        fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['en', 'Try again'],
        ['ja', '再試行'],
        ['zh', '重试'],
    ] as const)('%s: 재시도 버튼이 그 로케일 문구다', (locale, label) => {
        renderWithIntl(<SectorSignalError onRetry={vi.fn()} />, { locale });
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
});
