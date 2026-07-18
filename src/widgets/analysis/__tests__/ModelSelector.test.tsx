import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/widgets/analysis/ModelSelector';
import type { ModelId } from '@y0ngha/siglens-core';

const ALLOWED_MODELS: readonly ModelId[] = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'claude-sonnet-4-6',
] as const;

function renderSelector(
    props: Partial<{
        selectedModel: ModelId;
        onModelChange: (m: ModelId) => void;
        allowedModels: readonly ModelId[];
        disabled: boolean;
    }> = {}
) {
    const onModelChange = props.onModelChange ?? vi.fn();
    return {
        onModelChange,
        ...render(
            <ModelSelector
                selectedModel={props.selectedModel ?? 'gemini-2.5-flash-lite'}
                onModelChange={onModelChange}
                allowedModels={props.allowedModels ?? ALLOWED_MODELS}
                disabled={props.disabled}
            />
        ),
    };
}

describe('ModelSelector', () => {
    it('renders trigger button with selected model label', () => {
        renderSelector({ selectedModel: 'gemini-2.5-flash-lite' });
        expect(
            screen.getByRole('button', { name: 'AI 분석 모델 선택' })
        ).toBeInTheDocument();
        expect(screen.getByText('Flash Lite')).toBeInTheDocument();
    });

    it('opens dropdown on trigger click and shows allowed models', async () => {
        const user = userEvent.setup();
        renderSelector();

        await user.click(
            screen.getByRole('button', { name: 'AI 분석 모델 선택' })
        );

        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        expect(screen.getByText('Flash')).toBeInTheDocument();
        expect(screen.getByText('Sonnet')).toBeInTheDocument();
    });

    it('clicking a model option calls onModelChange and closes dropdown', async () => {
        const user = userEvent.setup();
        const { onModelChange } = renderSelector({
            selectedModel: 'gemini-2.5-flash-lite',
        });

        await user.click(
            screen.getByRole('button', { name: 'AI 분석 모델 선택' })
        );

        const flashOption = screen
            .getAllByRole('option')
            .find(
                o =>
                    o.textContent?.includes('Flash') &&
                    !o.textContent?.includes('Lite')
            );
        await user.click(flashOption!);

        expect(onModelChange).toHaveBeenCalledWith('gemini-2.5-flash');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('disabled prop prevents dropdown from opening', async () => {
        const user = userEvent.setup();
        renderSelector({ disabled: true });

        await user.click(
            screen.getByRole('button', { name: 'AI 분석 모델 선택' })
        );

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Escape closes the dropdown', async () => {
        const user = userEvent.setup();
        renderSelector();

        await user.click(
            screen.getByRole('button', { name: 'AI 분석 모델 선택' })
        );
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Escape does not propagate past the dropdown, so an ancestor Escape listener (e.g. a wrapping settings popover) does not also fire', async () => {
        const user = userEvent.setup();
        renderSelector();

        await user.click(
            screen.getByRole('button', { name: 'AI 분석 모델 선택' })
        );
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        const outerHandler = vi.fn();
        document.addEventListener('keydown', outerHandler);
        try {
            await user.keyboard('{Escape}');
        } finally {
            document.removeEventListener('keydown', outerHandler);
        }

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(outerHandler).not.toHaveBeenCalled();
    });

    it('renders the "AI MODEL" label with AA-contrast-safe secondary-400 text, not secondary-500', () => {
        renderSelector();
        const label = screen.getByText('AI MODEL');
        expect(label.className).toContain('text-secondary-400');
        expect(label.className).not.toContain('text-secondary-500');
    });
});
