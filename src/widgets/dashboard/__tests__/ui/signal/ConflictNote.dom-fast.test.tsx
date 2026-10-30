import { render, screen } from '@testing-library/react';
import { ConflictNote } from '@/widgets/dashboard/ui/signal/ConflictNote';

describe('ConflictNote', () => {
    it('상승·하락 건수를 한 문장으로 알린다', () => {
        render(
            <ConflictNote conflict={{ bullishCount: 3, bearishCount: 2 }} />
        );
        expect(
            screen.getByText('상승 3건 / 하락 2건 감지')
        ).toBeInTheDocument();
    });
});
