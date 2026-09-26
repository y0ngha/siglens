import { render, screen } from '@testing-library/react';
import { UntranslatedNotice } from '@/widgets/legal/UntranslatedNotice';

describe('UntranslatedNotice', () => {
    it('renders a role="note" banner naming both the requested and served locales in their native labels', () => {
        render(<UntranslatedNotice requested="en" served="ko" />);

        const note = screen.getByRole('note', { name: '번역 안내' });
        expect(note).toBeInTheDocument();
        expect(note).toHaveTextContent(
            '이 문서는 아직 English로 번역되지 않았습니다. 원문(한국어)을 표시합니다.'
        );
    });

    it('reflects a different requested/served pair', () => {
        render(<UntranslatedNotice requested="ja" served="en" />);

        expect(
            screen.getByRole('note', { name: '번역 안내' })
        ).toHaveTextContent(
            '이 문서는 아직 日本語로 번역되지 않았습니다. 원문(English)을 표시합니다.'
        );
    });

    it('applies the warning-tone container styling used to draw attention to the notice', () => {
        render(<UntranslatedNotice requested="en" served="ko" />);
        const note = screen.getByRole('note', { name: '번역 안내' });
        expect(note.className).toContain('border-ui-warning/30');
        expect(note.className).toContain('bg-ui-warning/5');
    });
});
