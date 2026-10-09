import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';
import { mockViewport } from '@/__tests__/utils/mockViewport';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/funnel/trackFunnelEvent', () => ({
    trackFunnelEvent: track,
}));

import { AnalysisSettingsMenu } from '@/widgets/analysis/AnalysisSettingsMenu';

function renderMenu(canUseReasoning: boolean) {
    const openSignupNudge = vi.fn();
    const setReasoning = vi.fn();
    render(
        <AnalysisSettingsMenu
            modelId={DEEPSEEK_V4_1_FLASH_MODEL}
            allowedModels={[DEEPSEEK_V4_1_FLASH_MODEL]}
            handleModelChange={vi.fn()}
            reasoning={false}
            setReasoning={setReasoning}
            canUseReasoning={canUseReasoning}
            isReasoningSupported
            openSignupNudge={openSignupNudge}
        />
    );
    return { openSignupNudge, setReasoning };
}

describe('AnalysisSettingsMenu 퍼널 이벤트', () => {
    beforeEach(() => {
        mockViewport(false);
        track.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('잠긴 추론 토글 클릭은 gate_clicked{reasoning_toggle}를 보내고 넛지를 연다', async () => {
        const user = userEvent.setup();
        const { openSignupNudge } = renderMenu(false);
        await user.click(screen.getByRole('button', { name: /^분석 설정/ }));
        await user.click(screen.getByRole('switch'));
        expect(track).toHaveBeenCalledWith('gate_clicked', {
            gate: 'reasoning_toggle',
        });
        expect(openSignupNudge).toHaveBeenCalledTimes(1);
    });

    it('회원의 토글 클릭은 기록하지 않는다', async () => {
        const user = userEvent.setup();
        const { setReasoning } = renderMenu(true);
        await user.click(screen.getByRole('button', { name: /^분석 설정/ }));
        await user.click(screen.getByRole('switch'));
        expect(setReasoning).toHaveBeenCalledWith(true);
        expect(track).not.toHaveBeenCalled();
    });
});
