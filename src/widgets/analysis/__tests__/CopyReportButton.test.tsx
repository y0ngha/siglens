import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { CopyReportButton } from '../ui/CopyReportButton';

const BUSY_CLASSES = [
    'aria-disabled:border-secondary-700',
    'aria-disabled:text-secondary-500',
    'aria-disabled:cursor-not-allowed',
];

describe('CopyReportButton', () => {
    it('진행 중이면 aria-disabled="true"이고 비활성 모양을 변형 클래스로 쓴다', () => {
        renderWithIntl(
            <CopyReportButton copyState="idle" isBusy onCopy={() => {}} />
        );

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).not.toBeDisabled();
        BUSY_CLASSES.forEach(cls => expect(button).toHaveClass(cls));
        expect(button).not.toHaveClass('border-border-control');
    });

    it('진행 중이 아니면 비활성 클래스 없이 기본 모양을 쓴다', () => {
        renderWithIntl(
            <CopyReportButton
                copyState="idle"
                isBusy={false}
                onCopy={() => {}}
            />
        );

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-disabled', 'false');
        BUSY_CLASSES.forEach(cls => expect(button).not.toHaveClass(cls));
        expect(button).toHaveClass(
            'border-border-control',
            'text-secondary-300'
        );
    });

    it.each([
        ['copied', 'border-primary-400/40'],
        ['failed', 'border-chart-bearish/40'],
    ] as const)('%s 결과는 자기 보더 색을 쓴다', (copyState, border) => {
        renderWithIntl(
            <CopyReportButton
                copyState={copyState}
                isBusy={false}
                onCopy={() => {}}
            />
        );

        const button = screen.getByRole('button');
        expect(button).toHaveClass(border);
        expect(button).not.toHaveClass('border-border-control');
    });
});
