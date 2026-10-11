const mocks = vi.hoisted(() => ({
    exclude: vi.fn(),
    include: vi.fn(),
    refresh: vi.fn(),
    showToast: vi.fn(),
}));

vi.mock('@/entities/email-report/actions/excludeReportSymbolAction', () => ({
    excludeReportSymbolAction: mocks.exclude,
}));
vi.mock('@/entities/email-report/actions/includeReportSymbolAction', () => ({
    includeReportSymbolAction: mocks.include,
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/shared/ui/ToastProvider', () => ({
    useToast: () => ({ showToast: mocks.showToast, dismiss: vi.fn() }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportSymbolChip } from '@/features/email-report-settings/ui/ReportSymbolChip';

function renderChip(props: {
    mode: 'exclude' | 'include';
    name?: string | null;
}) {
    return render(
        <ul>
            <ReportSymbolChip
                symbol="AAPL"
                name={props.name === undefined ? 'Apple' : props.name}
                mode={props.mode}
            />
        </ul>
    );
}

describe('ReportSymbolChip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.exclude.mockResolvedValue({ status: 'ok' });
        mocks.include.mockResolvedValue({ status: 'ok' });
    });

    describe('exclude 모드(리포트에 담긴 칩)', () => {
        it('exclude 모드는 이름이 든 라벨의 빼기 버튼을 그리고, 누르면 빼기 액션을 심볼과 함께 부른 뒤 새로고침한다', async () => {
            const user = userEvent.setup();
            renderChip({ mode: 'exclude' });

            await user.click(
                screen.getByRole('button', { name: 'Apple 리포트에서 빼기' })
            );

            await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
            expect(mocks.exclude).toHaveBeenCalledWith({ symbol: 'AAPL' });
            expect(mocks.include).not.toHaveBeenCalled();
            expect(mocks.showToast).not.toHaveBeenCalled();
        });

        it('이름이 없으면 라벨에 심볼을 쓴다', () => {
            renderChip({ mode: 'exclude', name: null });

            expect(
                screen.getByRole('button', { name: 'AAPL 리포트에서 빼기' })
            ).toBeInTheDocument();
        });
    });

    describe('include 모드(뺀 칩)', () => {
        it('include 모드는 다시 넣기 버튼을 그리고, 누르면 넣기 액션을 부른 뒤 새로고침한다', async () => {
            const user = userEvent.setup();
            renderChip({ mode: 'include' });

            const button = screen.getByRole('button', {
                name: 'Apple 리포트에 다시 넣기',
            });
            expect(button).toHaveTextContent('다시 넣기');
            await user.click(button);

            await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
            expect(mocks.include).toHaveBeenCalledWith({ symbol: 'AAPL' });
            expect(mocks.exclude).not.toHaveBeenCalled();
        });
    });

    describe('실패와 중복 호출', () => {
        it('액션이 오류 결과를 주면 그 문구로 토스트하고 새로고침하지 않는다', async () => {
            mocks.exclude.mockResolvedValue({
                status: 'error',
                code: 'limit_reached',
                message: '리포트에서 뺄 수 있는 종목은 최대 200개예요.',
            });
            const user = userEvent.setup();
            renderChip({ mode: 'exclude' });

            await user.click(screen.getByRole('button'));

            await waitFor(() =>
                expect(mocks.showToast).toHaveBeenCalledWith({
                    message: '리포트에서 뺄 수 있는 종목은 최대 200개예요.',
                })
            );
            expect(mocks.refresh).not.toHaveBeenCalled();
        });

        it('액션이 던지면 일반 실패 문구로 토스트한다', async () => {
            mocks.include.mockRejectedValue(new Error('network'));
            const user = userEvent.setup();
            renderChip({ mode: 'include' });

            await user.click(screen.getByRole('button'));

            await waitFor(() =>
                expect(mocks.showToast).toHaveBeenCalledWith({
                    message: '처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
                })
            );
            expect(mocks.refresh).not.toHaveBeenCalled();
        });

        it('요청이 끝날 때까지 버튼을 비활성화해 중복 호출을 막는다', async () => {
            let resolve!: (value: { status: 'ok' }) => void;
            mocks.exclude.mockReturnValue(
                new Promise(r => {
                    resolve = r;
                })
            );
            const user = userEvent.setup();
            renderChip({ mode: 'exclude' });
            const button = screen.getByRole('button');

            await user.click(button);

            await waitFor(() => expect(button).toBeDisabled());
            await user.click(button);
            expect(mocks.exclude).toHaveBeenCalledTimes(1);

            resolve({ status: 'ok' });
            await waitFor(() => expect(button).toBeEnabled());
        });
    });
});
