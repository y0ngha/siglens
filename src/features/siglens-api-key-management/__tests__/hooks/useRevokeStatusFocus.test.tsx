import { render, screen } from '@testing-library/react';
import type { RevokeSiglensApiKeyState } from '@/entities/siglens-api-key/model';
import { useRevokeStatusFocus } from '@/features/siglens-api-key-management/hooks/useRevokeStatusFocus';

function Harness({ state }: { state: RevokeSiglensApiKeyState }) {
    const regionRef = useRevokeStatusFocus(state);
    return <div ref={regionRef} tabIndex={-1} data-testid="region" />;
}

const REVOKED: RevokeSiglensApiKeyState = { status: 'revoked' };

describe('useRevokeStatusFocus', () => {
    it('마운트 때 이미 폐기 상태여도 포커스를 옮기지 않는다', () => {
        render(<Harness state={REVOKED} />);
        expect(screen.getByTestId('region')).not.toHaveFocus();
    });

    it('새 폐기 성공 결과가 오면 영역으로 포커스를 옮긴다', () => {
        const { rerender } = render(<Harness state={{ status: 'idle' }} />);
        rerender(<Harness state={REVOKED} />);
        expect(screen.getByTestId('region')).toHaveFocus();
    });

    it('폐기 오류에는 포커스를 옮기지 않는다', () => {
        const { rerender } = render(<Harness state={{ status: 'idle' }} />);
        rerender(
            <Harness
                state={{
                    status: 'error',
                    code: 'not_found',
                    message: '찾을 수 없는 키예요.',
                }}
            />
        );
        expect(screen.getByTestId('region')).not.toHaveFocus();
    });
});
