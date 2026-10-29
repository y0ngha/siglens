import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailReportSettingsSection } from '@/features/email-report-settings/ui/EmailReportSettingsSection';
import { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import type { EmailReportSettingsView } from '@/entities/email-report/model';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

vi.mock('@/entities/email-report/hooks/useEmailReportSettings');
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: vi.fn(),
}));

const mockUseSettings = vi.mocked(useEmailReportSettings);
type HookReturn = ReturnType<typeof useEmailReportSettings>;

const SAVED: EmailReportSettingsView = {
    enabled: true,
    daysOfWeek: [1, 3],
    sendHour: 21,
    timezone: 'Europe/Berlin',
    isSaved: true,
};

function setup(overrides: Partial<HookReturn> = {}) {
    const mutateAsync = vi.fn();
    const refetch = vi.fn();
    mockUseSettings.mockReturnValue({
        settings: SAVED,
        isPending: false,
        isError: false,
        refetch,
        save: {
            mutateAsync,
            isPending: false,
        } as unknown as HookReturn['save'],
        ...overrides,
    });
    return { mutateAsync, refetch };
}

describe('EmailReportSettingsSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, '', '/email-report');
    });

    it('조회 중이면 로딩 상태를 알린다', () => {
        setup({ isPending: true, settings: undefined });
        render(<EmailReportSettingsSection />);

        expect(
            screen.getByText('메일 리포트 설정을 불러오는 중')
        ).toBeInTheDocument();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('조회 실패면 다시 시도 버튼이 refetch를 부른다', async () => {
        const { refetch } = setup({ isError: true, settings: undefined });
        render(<EmailReportSettingsSection />);

        await userEvent.click(
            screen.getByRole('button', { name: '다시 시도' })
        );

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('저장된 설정으로 스위치·요일·시각·타임존을 채운다', () => {
        setup();
        render(<EmailReportSettingsSection />);

        expect(screen.getByRole('switch')).toBeChecked();
        const checked = screen
            .getAllByRole('checkbox')
            .filter(box => (box as HTMLInputElement).checked);
        expect(checked).toHaveLength(2);
        expect(screen.getByLabelText('받을 시각')).toHaveValue('21');
        expect(screen.getByText(/Europe\/Berlin/)).toBeInTheDocument();
    });

    it('수정한 값을 저장하고 성공 문구를 보인다', async () => {
        const { mutateAsync } = setup();
        mutateAsync.mockResolvedValue({ status: 'ok', settings: SAVED });
        render(<EmailReportSettingsSection />);

        await userEvent.selectOptions(screen.getByLabelText('받을 시각'), '6');
        await userEvent.click(screen.getByRole('button', { name: '저장' }));

        expect(mutateAsync).toHaveBeenCalledWith({
            enabled: true,
            daysOfWeek: [1, 3],
            sendHour: 6,
            timezone: 'Europe/Berlin',
        });
        expect(await screen.findByText('저장했어요.')).toBeInTheDocument();
    });

    it('저장 중이면 폼 제출(Enter 등)을 다시 보내지 않는다', () => {
        const mutateAsync = vi.fn();
        setup({
            save: {
                mutateAsync,
                isPending: true,
            } as unknown as HookReturn['save'],
        });
        render(<EmailReportSettingsSection />);

        // 폼 제출(Enter)은 버튼을 거치지 않으므로 제출 가드가 막아야 한다.
        const form = screen.getByRole('switch').closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(mutateAsync).not.toHaveBeenCalled();
    });

    describe('저장 중인 저장 버튼', () => {
        function setupSaving() {
            const mutateAsync = vi.fn();
            setup({
                save: {
                    mutateAsync,
                    isPending: true,
                } as unknown as HookReturn['save'],
            });
            render(<EmailReportSettingsSection />);
            return {
                mutateAsync,
                button: screen.getByRole('button', { name: '저장 중…' }),
            };
        }

        /** `disabled`가 되면 포커스를 쥔 버튼에서 포커스가 body로 떨어진다(REACT.md#AX-3). */
        it('disabled가 아니라 aria-disabled로 표시한다', () => {
            const { button } = setupSaving();
            expect(button).not.toBeDisabled();
            expect(button).toHaveAttribute('aria-disabled', 'true');
        });

        it('포커스를 쥔 채로 남는다', () => {
            const { button } = setupSaving();
            button.focus();
            expect(button).toHaveFocus();
        });

        it('눌러도 다시 저장하지 않는다', async () => {
            const { mutateAsync, button } = setupSaving();
            await userEvent.click(button);
            expect(mutateAsync).not.toHaveBeenCalled();
        });
    });

    it('서버 오류 결과의 문구를 그대로 보인다', async () => {
        const { mutateAsync } = setup();
        mutateAsync.mockResolvedValue({
            status: 'error',
            code: 'invalid_timezone',
            message: '서버가 보낸 오류 문구',
        });
        render(<EmailReportSettingsSection />);

        await userEvent.click(screen.getByRole('button', { name: '저장' }));

        expect(
            await screen.findByText('서버가 보낸 오류 문구')
        ).toBeInTheDocument();
    });

    it('마지막 남은 요일은 해제할 수 없고, 다른 요일은 자유롭게 고른다', async () => {
        const { mutateAsync } = setup({
            settings: { ...SAVED, daysOfWeek: [1] },
        });
        mutateAsync.mockResolvedValue({ status: 'ok', settings: SAVED });
        render(<EmailReportSettingsSection />);

        const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const onlyDay = boxes.find(box => box.checked)!;
        expect(onlyDay).toBeDisabled();
        expect(
            screen.getByText('요일을 하나 이상 골라 주세요.')
        ).toBeInTheDocument();

        // 다른 요일을 고르면 마지막 요일 잠금이 풀린다.
        await userEvent.click(boxes.find(box => !box.checked)!);
        expect(onlyDay).toBeEnabled();
        await userEvent.click(onlyDay);
        await userEvent.click(screen.getByRole('button', { name: '저장' }));

        expect(mutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({ daysOfWeek: [2] })
        );
    });

    it('수신을 끄면 요일·시각 입력이 비활성화된다', async () => {
        setup();
        render(<EmailReportSettingsSection />);

        await userEvent.click(screen.getByRole('switch'));

        expect(screen.getByLabelText('받을 시각')).toBeDisabled();
        expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
    });

    /**
     * 꺼진 상태는 묶음 `opacity-*`가 아니라 칩의 비활성 토큰으로 보인다(DESIGN.md#DS-3) —
     * 불투명도는 요일 안내·타임존 안내 글자까지 라이트 테마 4.5:1 아래로 끌어내린다.
     */
    describe('수신을 끈 요일·시각 묶음', () => {
        it('불투명도로 흐리게 하지 않는다', async () => {
            setup();
            const { container } = render(<EmailReportSettingsSection />);

            await userEvent.click(screen.getByRole('switch'));

            expect(container.querySelector('[class*="opacity-"]')).toBeNull();
        });

        it('고른 요일 칩은 비활성 채움 토큰으로 보인다', async () => {
            setup();
            render(<EmailReportSettingsSection />);

            await userEvent.click(screen.getByRole('switch'));

            const checkedChip = screen
                .getByRole('checkbox', { name: '월' })
                .closest('label');
            expect(checkedChip).toHaveClass(
                'bg-secondary-700',
                'text-secondary-500',
                'border-border-control'
            );
        });

        it('고르지 않은 요일 칩은 비활성 글자 토큰으로 보인다', async () => {
            setup();
            render(<EmailReportSettingsSection />);

            await userEvent.click(screen.getByRole('switch'));

            const uncheckedChip = screen
                .getByRole('checkbox', { name: '화' })
                .closest('label');
            expect(uncheckedChip).toHaveClass('text-secondary-500');
        });
    });

    it('처음 설정하는 회원은 브라우저 타임존으로 저장한다', async () => {
        const { mutateAsync } = setup({
            settings: { ...SAVED, isSaved: false, timezone: 'Asia/Seoul' },
        });
        mutateAsync.mockResolvedValue({ status: 'ok', settings: SAVED });
        const real = Intl.DateTimeFormat.prototype.resolvedOptions;
        const spy = vi
            .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
            .mockImplementation(function (this: Intl.DateTimeFormat) {
                return { ...real.call(this), timeZone: 'Pacific/Auckland' };
            });
        try {
            render(<EmailReportSettingsSection />);

            await userEvent.click(screen.getByRole('button', { name: '저장' }));

            expect(mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ timezone: 'Pacific/Auckland' })
            );
        } finally {
            spy.mockRestore();
        }
    });

    it('수신을 끈 채로도 저장할 수 있다 — 요일이 비는 상태가 없다', async () => {
        const { mutateAsync } = setup({
            settings: { ...SAVED, daysOfWeek: [1] },
        });
        mutateAsync.mockResolvedValue({ status: 'ok', settings: SAVED });
        render(<EmailReportSettingsSection />);

        await userEvent.click(screen.getByRole('switch'));
        await userEvent.click(screen.getByRole('button', { name: '저장' }));

        expect(mutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false, daysOfWeek: [1] })
        );
    });

    it('안내 문구가 상세·요약 종목 수를 보인다', () => {
        setup();
        render(<EmailReportSettingsSection />);

        expect(
            screen.getByText(/최대 5개는 일봉 차트.*그다음 최대 15개는/)
        ).toBeInTheDocument();
    });

    describe('report_enabled 퍼널 이벤트', () => {
        const OFF: EmailReportSettingsView = { ...SAVED, enabled: false };

        async function turnOnAndSave() {
            await userEvent.click(screen.getByRole('switch'));
            await userEvent.click(screen.getByRole('button', { name: '저장' }));
        }

        it('꺼짐 → 켜짐으로 저장되면 settings 출처로 보낸다', async () => {
            const { mutateAsync } = setup({ settings: OFF });
            mutateAsync.mockResolvedValue({
                status: 'ok',
                settings: { ...OFF, enabled: true },
            });
            render(<EmailReportSettingsSection />);

            await turnOnAndSave();

            expect(await screen.findByText('저장했어요.')).toBeInTheDocument();
            expect(trackFunnelEvent).toHaveBeenCalledWith('report_enabled', {
                source: 'settings',
            });
        });

        it('?from=nudge로 열었으면 nudge 출처로 보낸다', async () => {
            window.history.replaceState({}, '', '/email-report?from=nudge');
            const { mutateAsync } = setup({ settings: OFF });
            mutateAsync.mockResolvedValue({
                status: 'ok',
                settings: { ...OFF, enabled: true },
            });
            render(<EmailReportSettingsSection />);

            await turnOnAndSave();

            expect(await screen.findByText('저장했어요.')).toBeInTheDocument();
            expect(trackFunnelEvent).toHaveBeenCalledWith('report_enabled', {
                source: 'nudge',
            });
        });

        it('켜진 채 다시 저장하면 보내지 않는다', async () => {
            const { mutateAsync } = setup();
            mutateAsync.mockResolvedValue({ status: 'ok', settings: SAVED });
            render(<EmailReportSettingsSection />);

            await userEvent.click(screen.getByRole('button', { name: '저장' }));

            expect(await screen.findByText('저장했어요.')).toBeInTheDocument();
            expect(trackFunnelEvent).not.toHaveBeenCalled();
        });

        it('켜짐 저장 뒤 같은 세션에서 다시 저장해도 한 번만 보낸다', async () => {
            const { mutateAsync } = setup({ settings: OFF });
            mutateAsync.mockResolvedValue({
                status: 'ok',
                settings: { ...OFF, enabled: true },
            });
            render(<EmailReportSettingsSection />);

            await turnOnAndSave();
            await screen.findByText('저장했어요.');
            await userEvent.click(screen.getByRole('button', { name: '저장' }));

            expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
        });

        it('저장이 실패하면 보내지 않는다', async () => {
            const { mutateAsync } = setup({ settings: OFF });
            mutateAsync.mockResolvedValue({
                status: 'error',
                code: 'storage_unavailable',
                message: '실패',
            });
            render(<EmailReportSettingsSection />);

            await turnOnAndSave();

            expect(await screen.findByText('실패')).toBeInTheDocument();
            expect(trackFunnelEvent).not.toHaveBeenCalled();
        });
    });
});
