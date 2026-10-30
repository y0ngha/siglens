import { render, screen } from '@testing-library/react';
import { UserMenuSkeleton } from '../../../ui/user-menu/UserMenuSkeleton';

describe('UserMenuSkeleton', () => {
    it('이름 붙은 status로 로딩을 알린다', () => {
        render(<UserMenuSkeleton />);

        expect(
            screen.getByRole('status', { name: '로딩 중' })
        ).toBeInTheDocument();
    });
});
