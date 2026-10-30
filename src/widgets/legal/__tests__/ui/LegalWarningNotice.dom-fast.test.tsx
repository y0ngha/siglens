import { render, screen } from '@testing-library/react';
import { LegalWarningNotice } from '@/widgets/legal/ui/notice/LegalWarningNotice';

describe('LegalWarningNotice', () => {
    it('renders the given role with its accessible name and text', () => {
        render(
            <LegalWarningNotice role="status" label="문서 불러오기 안내">
                잠시 후 다시 열어 주세요.
            </LegalWarningNotice>
        );

        expect(
            screen.getByRole('status', { name: '문서 불러오기 안내' })
        ).toHaveTextContent('잠시 후 다시 열어 주세요.');
    });

    it('uses the warning-tone container for a note', () => {
        render(
            <LegalWarningNotice role="note" label="번역 안내">
                원문을 표시합니다.
            </LegalWarningNotice>
        );

        const note = screen.getByRole('note', { name: '번역 안내' });
        expect(note.className).toContain('border-ui-warning/30');
        expect(note.className).toContain('bg-ui-warning/5');
    });
});
