import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailReportSettingsSection } from '@/features/email-report-settings/ui/EmailReportSettingsSection';
import { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import type { EmailReportSettingsView } from '@/entities/email-report/model';

vi.mock('@/entities/email-report/hooks/useEmailReportSettings');

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
});
