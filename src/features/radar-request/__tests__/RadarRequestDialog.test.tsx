import { fireEvent, render, screen } from '@testing-library/react';
import { RadarRequestDialog } from '@/features/radar-request/ui/RadarRequestDialog';
import ko from '../../../../messages/ko.json';

vi.mock('@/features/radar-request/ui/RadarRequestForm', () => ({
    RadarRequestForm: () => <div data-testid="radar-request-form" />,
}));

const t = ko.features['radar-request'];

describe('RadarRequestDialog', () => {
    it('트리거 버튼을 보이고, 열기 전에는 내용을 마운트하지 않는다', () => {
        render(
            <RadarRequestDialog
                triggerLabel="종목 요청하기"
                triggerClassName="custom-trigger"
            />
        );

        const trigger = screen.getByRole('button', { name: '종목 요청하기' });
        expect(trigger).toHaveClass('custom-trigger');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByTestId('radar-request-form')).toBeNull();
    });

    it('트리거를 누르면 제목이 aria-labelledby 로 걸린 모달과 폼이 열린다', async () => {
        render(<RadarRequestDialog triggerLabel="종목 요청하기" />);

        fireEvent.click(screen.getByRole('button', { name: '종목 요청하기' }));

        const dialog = screen.getByRole('dialog', { name: t.dialogTitle });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText(t.dialogDescription)).toBeInTheDocument();
        expect(
            await screen.findByTestId('radar-request-form')
        ).toBeInTheDocument();
    });

    it('닫기 버튼을 누르면 내용이 언마운트된다', async () => {
        render(<RadarRequestDialog triggerLabel="종목 요청하기" />);
        fireEvent.click(screen.getByRole('button', { name: '종목 요청하기' }));

        await screen.findByTestId('radar-request-form');

        fireEvent.click(screen.getByRole('button', { name: t.close }));

        expect(screen.queryByTestId('radar-request-form')).toBeNull();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
