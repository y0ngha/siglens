import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import {
    type SaveMutation,
    useEmailReportSettingsForm,
} from '@/features/email-report-settings/hooks/useEmailReportSettingsForm';
import type { EmailReportSettingsView } from '@/entities/email-report/model';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: vi.fn(),
}));

const INITIAL: EmailReportSettingsView = {
    enabled: true,
    daysOfWeek: [2],
    sendHour: 7,
    timezone: 'Europe/Paris',
    isSaved: true,
};

function makeSave(mutateAsync = vi.fn(), isPending = false): SaveMutation {
    return { mutateAsync, isPending } as unknown as SaveMutation;
}

function submitEvent(): Parameters<
    ReturnType<typeof useEmailReportSettingsForm>['handleSubmit']
>[0] {
    return { preventDefault: vi.fn() } as unknown as ReturnType<
        typeof submitEvent
    >;
}

function switchEvent(checked: boolean): ChangeEvent<HTMLInputElement> {
    return { target: { checked } } as ChangeEvent<HTMLInputElement>;
}

describe('useEmailReportSettingsForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.history.replaceState({}, '', '/email-report');
    });

    it('요일 칩을 월요일부터 7개 내고, 마지막 남은 요일을 표시한다', () => {
        const { result } = renderHook(() =>
            useEmailReportSettingsForm(INITIAL, makeSave())
        );
        expect(
            result.current.weekdayOptions.map(
                ({ day, checked, isOnlyDay }) => ({
                    day,
                    checked,
                    isOnlyDay,
                })
            )
        ).toEqual([
            { day: 1, checked: false, isOnlyDay: false },
            { day: 2, checked: true, isOnlyDay: true },
            { day: 3, checked: false, isOnlyDay: false },
            { day: 4, checked: false, isOnlyDay: false },
            { day: 5, checked: false, isOnlyDay: false },
            { day: 6, checked: false, isOnlyDay: false },
            { day: 0, checked: false, isOnlyDay: false },
        ]);
    });

    it('시각 옵션은 24개다', () => {
        const { result } = renderHook(() =>
            useEmailReportSettingsForm(INITIAL, makeSave())
        );
        expect(result.current.hourOptions).toHaveLength(24);
    });

    it('스위치를 끄면 enabled가 false가 된다', () => {
        const { result } = renderHook(() =>
            useEmailReportSettingsForm(INITIAL, makeSave())
        );
        act(() => result.current.handleEnabledChange(switchEvent(false)));
        expect(result.current.enabled).toBe(false);
    });

    it('값을 바꾸면 지난 저장 문구를 지운다', async () => {
        const mutateAsync = vi
            .fn()
            .mockResolvedValue({ status: 'ok', settings: INITIAL });
        const { result } = renderHook(() =>
            useEmailReportSettingsForm(INITIAL, makeSave(mutateAsync))
        );
        await act(async () => {
            await result.current.handleSubmit({
                preventDefault: vi.fn(),
            } as unknown as Parameters<typeof result.current.handleSubmit>[0]);
        });
        expect(result.current.message).toEqual({
            tone: 'ok',
            text: '저장했어요.',
        });
        act(() => result.current.handleDayToggle(4));
        expect(result.current.message).toBeNull();
    });

    it('저장 액션이 던지면 일반 실패 문구를 보인다', async () => {
        const mutateAsync = vi.fn().mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() =>
            useEmailReportSettingsForm(INITIAL, makeSave(mutateAsync))
        );
        await act(async () => {
            await result.current.handleSubmit({
                preventDefault: vi.fn(),
            } as unknown as Parameters<typeof result.current.handleSubmit>[0]);
        });
        expect(result.current.message).toEqual({
            tone: 'error',
            text: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.',
        });
    });

    it('리렌더해도 반환된 핸들러 참조를 유지한다', () => {
        const save = makeSave();
        const { result, rerender } = renderHook(() =>
            useEmailReportSettingsForm(INITIAL, save)
        );
        const first = result.current;
        rerender();
        expect(result.current.handleEnabledChange).toBe(
            first.handleEnabledChange
        );
        expect(result.current.handleDayToggle).toBe(first.handleDayToggle);
        expect(result.current.handleHourChange).toBe(first.handleHourChange);
        expect(result.current.handleSubmit).toBe(first.handleSubmit);
    });

    it('저장 중에는 제출해도 저장 요청을 다시 보내지 않는다', async () => {
        const mutateAsync = vi.fn();
        const { result } = renderHook(() =>
            useEmailReportSettingsForm(INITIAL, makeSave(mutateAsync, true))
        );
        await act(async () => {
            await result.current.handleSubmit(submitEvent());
        });
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    describe('report_enabled 퍼널 이벤트', () => {
        const OFF: EmailReportSettingsView = { ...INITIAL, enabled: false };

        async function submitWith(
            initial: EmailReportSettingsView,
            savedEnabled: boolean
        ) {
            const mutateAsync = vi.fn().mockResolvedValue({
                status: 'ok',
                settings: { ...initial, enabled: savedEnabled },
            });
            const { result } = renderHook(() =>
                useEmailReportSettingsForm(initial, makeSave(mutateAsync))
            );
            await act(async () => {
                await result.current.handleSubmit(submitEvent());
            });
        }

        it('꺼짐에서 켜짐으로 저장되면 settings 출처로 한 번 보낸다', async () => {
            await submitWith(OFF, true);
            expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
            expect(trackFunnelEvent).toHaveBeenCalledWith('report_enabled', {
                source: 'settings',
            });
        });

        it('이미 켜져 있던 설정을 저장하면 보내지 않는다', async () => {
            await submitWith(INITIAL, true);
            expect(trackFunnelEvent).not.toHaveBeenCalled();
        });
    });

    describe('처음 보여 줄 타임존', () => {
        function mockBrowserTimeZone(timeZone: string) {
            const real = Intl.DateTimeFormat.prototype.resolvedOptions;
            return vi
                .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
                .mockImplementation(function (this: Intl.DateTimeFormat) {
                    return { ...real.call(this), timeZone };
                });
        }

        it('처음 설정하는 회원은 브라우저 타임존을 쓴다', () => {
            const spy = mockBrowserTimeZone('Pacific/Auckland');
            try {
                const { result } = renderHook(() =>
                    useEmailReportSettingsForm(
                        { ...INITIAL, isSaved: false, timezone: 'Asia/Seoul' },
                        makeSave()
                    )
                );
                expect(result.current.timezone).toBe('Pacific/Auckland');
            } finally {
                spy.mockRestore();
            }
        });

        it('저장된 설정은 저장된 타임존을 유지한다', () => {
            const spy = mockBrowserTimeZone('Pacific/Auckland');
            try {
                const { result } = renderHook(() =>
                    useEmailReportSettingsForm(INITIAL, makeSave())
                );
                expect(result.current.timezone).toBe('Europe/Paris');
            } finally {
                spy.mockRestore();
            }
        });
    });
});
