import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEEPSEEK_V4_FLASH_MODEL, type ModelId } from '@y0ngha/siglens-core';
import { AnalysisSettingsMenu } from '@/widgets/analysis/AnalysisSettingsMenu';

const ALLOWED_MODELS: readonly ModelId[] = [
    DEEPSEEK_V4_FLASH_MODEL,
    'gemini-2.5-flash',
] as const;

function renderMenu(
    props: Partial<{
        modelId: ModelId;
        allowedModels: readonly ModelId[];
        handleModelChange: (m: ModelId) => void;
        reasoning: boolean;
        setReasoning: (v: boolean) => void;
        canUseReasoning: boolean;
        openSignupNudge: () => void;
    }> = {}
) {
    const handleModelChange = props.handleModelChange ?? vi.fn();
    const setReasoning = props.setReasoning ?? vi.fn();
    const openSignupNudge = props.openSignupNudge ?? vi.fn();
    return {
        handleModelChange,
        setReasoning,
        openSignupNudge,
        ...render(
            <AnalysisSettingsMenu
                modelId={props.modelId ?? DEEPSEEK_V4_FLASH_MODEL}
                allowedModels={props.allowedModels ?? ALLOWED_MODELS}
                handleModelChange={handleModelChange}
                reasoning={props.reasoning ?? false}
                setReasoning={setReasoning}
                canUseReasoning={props.canUseReasoning ?? true}
                openSignupNudge={openSignupNudge}
            />
        ),
    };
}

function gearButton() {
    return screen.getByRole('button', { name: /^분석 설정/ });
}

describe('AnalysisSettingsMenu', () => {
    it('opens the popover on gear click', async () => {
        const user = userEvent.setup();
        renderMenu();

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(gearButton());

        expect(
            screen.getByRole('dialog', { name: '분석 설정' })
        ).toBeInTheDocument();
    });

    it('closes the popover on a second gear click', async () => {
        const user = userEvent.setup();
        renderMenu();

        await user.click(gearButton());
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.click(gearButton());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape closes the popover and returns focus to the gear', async () => {
        const user = userEvent.setup();
        renderMenu();

        await user.click(gearButton());
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(gearButton());
    });

    it('click outside closes the popover', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <AnalysisSettingsMenu
                    modelId={DEEPSEEK_V4_FLASH_MODEL}
                    allowedModels={ALLOWED_MODELS}
                    handleModelChange={vi.fn()}
                    reasoning={false}
                    setReasoning={vi.fn()}
                    canUseReasoning={true}
                    openSignupNudge={vi.fn()}
                />
                <div data-testid="outside">outside</div>
            </div>
        );

        await user.click(gearButton());
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.pointerDown(screen.getByTestId('outside'));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('on open, moves focus to the model selector trigger', async () => {
        const user = userEvent.setup();
        renderMenu();

        await user.click(gearButton());

        await waitFor(() => {
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'AI 분석 모델 선택' })
            );
        });
    });

    it('shows no active dot and a plain aria-label when reasoning is off and the model is the default', () => {
        renderMenu({ reasoning: false, modelId: DEEPSEEK_V4_FLASH_MODEL });

        const gear = gearButton();
        expect(gear.getAttribute('aria-label')).toBe('분석 설정');
        expect(gear.querySelector('.bg-primary-500')).toBeNull();
    });

    it('shows the active dot and an updated aria-label when reasoning is on', () => {
        renderMenu({ reasoning: true, modelId: DEEPSEEK_V4_FLASH_MODEL });

        const gear = gearButton();
        expect(gear.getAttribute('aria-label')).toBe('분석 설정 (변경됨)');
        expect(gear.querySelector('.bg-primary-500')).not.toBeNull();
    });

    it('shows the active dot when a non-default model is selected', () => {
        renderMenu({ reasoning: false, modelId: 'gemini-2.5-flash' });

        const gear = gearButton();
        expect(gear.getAttribute('aria-label')).toBe('분석 설정 (변경됨)');
        expect(gear.querySelector('.bg-primary-500')).not.toBeNull();
    });

    it('a locked (canUseReasoning=false) member clicking the switch fires openSignupNudge, not setReasoning', async () => {
        const user = userEvent.setup();
        const { setReasoning, openSignupNudge } = renderMenu({
            canUseReasoning: false,
        });

        await user.click(gearButton());
        await user.click(screen.getByRole('switch'));

        expect(openSignupNudge).toHaveBeenCalledTimes(1);
        expect(setReasoning).not.toHaveBeenCalled();
    });

    it('an unlocked member clicking the switch calls setReasoning', async () => {
        const user = userEvent.setup();
        const { setReasoning, openSignupNudge } = renderMenu({
            canUseReasoning: true,
            reasoning: false,
        });

        await user.click(gearButton());
        await user.click(screen.getByRole('switch'));

        expect(setReasoning).toHaveBeenCalledWith(true);
        expect(openSignupNudge).not.toHaveBeenCalled();
    });

    it('changing the model in the popover calls handleModelChange', async () => {
        const user = userEvent.setup();
        const { handleModelChange } = renderMenu({
            modelId: DEEPSEEK_V4_FLASH_MODEL,
            allowedModels: ALLOWED_MODELS,
        });

        await user.click(gearButton());
        await user.click(
            screen.getByRole('button', { name: 'AI 분석 모델 선택' })
        );

        const flashOption = screen
            .getAllByRole('option')
            .find(
                o =>
                    o.textContent?.includes('Flash') &&
                    !o.textContent?.includes('DeepSeek')
            );
        await user.click(flashOption!);

        expect(handleModelChange).toHaveBeenCalledWith('gemini-2.5-flash');
    });
});
