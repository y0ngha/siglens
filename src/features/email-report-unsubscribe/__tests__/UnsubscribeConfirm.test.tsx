const search = vi.hoisted(() => ({ value: 'u=user-1&sig=abc' }));

vi.mock('next/navigation', async importOriginal => ({
    ...(await importOriginal<typeof import('next/navigation')>()),
    useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock('@/features/email-report-unsubscribe/hooks/useUnsubscribeEmailReport');

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useUnsubscribeEmailReport } from '@/features/email-report-unsubscribe/hooks/useUnsubscribeEmailReport';
import { UnsubscribeConfirm } from '@/features/email-report-unsubscribe/ui/UnsubscribeConfirm';

type HookReturn = ReturnType<typeof useUnsubscribeEmailReport>;

function setup(overrides: Partial<HookReturn> = {}) {
    const mutate = vi.fn();
    vi.mocked(useUnsubscribeEmailReport).mockReturnValue({
        mutate,
        data: undefined,
        isPending: false,
        isError: false,
        ...overrides,
    } as unknown as HookReturn);
    return { mutate };
}

describe('UnsubscribeConfirm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        search.value = 'u=user-1&sig=abc';
    });

    it('링크를 연 것만으로는 끄지 않고, 버튼을 누르면 쿼리의 id·서명으로 요청한다', async () => {
        const { mutate } = setup();
        render(<UnsubscribeConfirm />);

        expect(mutate).not.toHaveBeenCalled();
        await userEvent.click(
            screen.getByRole('button', { name: '수신 거부하기' })
        );

        expect(mutate).toHaveBeenCalledWith({
            userId: 'user-1',
            signature: 'abc',
        });
    });

    it('쿼리가 빠지면 잘못된 링크 안내만 보인다', () => {
        search.value = 'u=user-1';
        setup();
        render(<UnsubscribeConfirm />);

        expect(screen.getByRole('alert')).toHaveTextContent(
            '수신거부 링크가 올바르지 않아요'
        );
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('성공하면 완료 안내와 계정 설정 링크를 보이고 버튼을 내린다', () => {
        setup({ data: { status: 'ok' } });
        render(<UnsubscribeConfirm />);

        expect(
            screen.getByText('메일 리포트를 더 이상 보내지 않아요.')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '메일 리포트 설정으로 가기' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('서버 오류 결과의 문구를 보인다', () => {
        setup({
            data: {
                status: 'error',
                code: 'invalid_link',
                message: '서버 문구',
            },
        });
        render(<UnsubscribeConfirm />);

        expect(screen.getByRole('alert')).toHaveTextContent('서버 문구');
    });

    it('요청 자체가 실패하면 일반 실패 문구를 보인다', () => {
        setup({ isError: true });
        render(<UnsubscribeConfirm />);

        expect(screen.getByRole('alert')).toHaveTextContent(
            '수신거부에 실패했어요'
        );
    });

    it('처리 중에는 버튼을 막는다', () => {
        setup({ isPending: true });
        render(<UnsubscribeConfirm />);

        expect(screen.getByRole('button', { name: '처리 중…' })).toBeDisabled();
    });
});
