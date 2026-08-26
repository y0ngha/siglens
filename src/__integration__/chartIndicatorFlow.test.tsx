import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IndicatorSettingsModal } from '@/widgets/chart/ui/IndicatorSettingsModal';
import {
    INDICATOR_META,
    type IndicatorBinding,
} from '@/widgets/chart/model/indicatorRegistry';

vi.mock('@/shared/lib/chartColors', () => ({
    getPeriodColor: (period: number) => `hsl(${period * 10}, 70%, 50%)`,
    /* 차트 크롬을 런타임 테마에서 읽는 리졸버. 테스트는 다크 고정이면 충분하다. */
    getChartChrome: () => ({
        background: '#1a1a2e',
        grid: '#2a2a3e',
        text: '#a0a0b0',
    }),
}));

interface FlowCallbacks {
    onToggleRsi: ReturnType<typeof vi.fn<() => void>>;
    onToggleMaPeriod: ReturnType<typeof vi.fn<(period: number) => void>>;
}

function makeBindings(cb: FlowCallbacks): IndicatorBinding[] {
    return [
        {
            meta: INDICATOR_META.ma,
            active: false,
            availablePeriods: [5, 10, 20, 50, 100, 200],
            visiblePeriods: [],
            onTogglePeriod: cb.onToggleMaPeriod,
        },
        { meta: INDICATOR_META.rsi, active: false, onToggle: cb.onToggleRsi },
        { meta: INDICATOR_META.bollinger, active: false, onToggle: vi.fn() },
        {
            meta: INDICATOR_META.volumeProfile,
            active: false,
            onToggle: vi.fn(),
        },
    ];
}

function makeCallbacks(): FlowCallbacks {
    return {
        onToggleRsi: vi.fn<() => void>(),
        onToggleMaPeriod: vi.fn<(period: number) => void>(),
    };
}

describe('Chart Indicator Flow (settings modal, real useDialog)', () => {
    it('shows the gear trigger and keeps the dialog closed initially', () => {
        render(
            <IndicatorSettingsModal bindings={makeBindings(makeCallbacks())} />
        );
        expect(
            screen.getByRole('button', { name: '보조지표 설정' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the dialog and groups indicators by category when the gear is clicked', async () => {
        const user = userEvent.setup();
        render(
            <IndicatorSettingsModal bindings={makeBindings(makeCallbacks())} />
        );
        await user.click(screen.getByRole('button', { name: '보조지표 설정' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('추세')).toBeInTheDocument();
        expect(screen.getByText('모멘텀')).toBeInTheDocument();
        expect(screen.getByText('변동성')).toBeInTheDocument();
        expect(screen.getByText('볼륨')).toBeInTheDocument();
        expect(screen.queryByText('SMC')).not.toBeInTheDocument();
    });

    it('calls the RSI toggle when its checkbox is clicked', async () => {
        const cb = makeCallbacks();
        const user = userEvent.setup();
        render(<IndicatorSettingsModal bindings={makeBindings(cb)} />);
        await user.click(screen.getByRole('button', { name: '보조지표 설정' }));
        await user.click(screen.getByRole('checkbox', { name: /RSI/ }));
        expect(cb.onToggleRsi).toHaveBeenCalledTimes(1);
    });

    it('calls the MA period toggle when a period chip is clicked', async () => {
        const cb = makeCallbacks();
        const user = userEvent.setup();
        render(<IndicatorSettingsModal bindings={makeBindings(cb)} />);
        await user.click(screen.getByRole('button', { name: '보조지표 설정' }));
        await user.click(screen.getByRole('button', { name: /^20$/ }));
        expect(cb.onToggleMaPeriod).toHaveBeenCalledWith(20);
    });

    it('closes the dialog when the close button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <IndicatorSettingsModal bindings={makeBindings(makeCallbacks())} />
        );
        await user.click(screen.getByRole('button', { name: '보조지표 설정' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '닫기' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the dialog when Escape is pressed (real useDialog)', async () => {
        const user = userEvent.setup();
        render(
            <IndicatorSettingsModal bindings={makeBindings(makeCallbacks())} />
        );
        await user.click(screen.getByRole('button', { name: '보조지표 설정' }));
        // 네이티브 <dialog>는 showModal()이 effect에서 호출된 뒤에야 열린다. dialog가
        // 접근성 트리에 뜰 때까지 기다린 다음 Escape를 발화한다 — 열리기 전에 쏘면
        // CI(vmThreads)에서 이벤트 유실 flake가 난다(MISTAKES.md §19).
        // 포커스는 브라우저가 dialog 내부 첫 포커서블로 옮기므로 dialog 자신을
        // 단언하지 않는다(jsdom 폴리필도 포커스를 옮기지 않는다).
        await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible());
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
