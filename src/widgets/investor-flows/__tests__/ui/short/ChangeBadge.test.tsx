// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChangeBadge } from '../../../ui/short/ChangeBadge';

describe('ChangeBadge', () => {
    it('반올림하면 0인 변화는 ■ 변화 없음 옆에 부호 없는 0.0%로 보인다', () => {
        render(<ChangeBadge changePct={-0.04} />);
        expect(screen.getByText('0.0%')).toBeInTheDocument();
        expect(screen.getByText('변화 없음')).toBeInTheDocument();
        expect(screen.queryByText(/-0\.0%/)).toBeNull();
        expect(screen.queryByText(/\+0\.0%/)).toBeNull();
    });

    it('증가·감소는 부호가 붙는다', () => {
        const { unmount } = render(<ChangeBadge changePct={2.46} />);
        expect(screen.getByText('+2.5%')).toBeInTheDocument();
        unmount();
        render(<ChangeBadge changePct={-3} />);
        expect(screen.getByText('-3.0%')).toBeInTheDocument();
    });
});
