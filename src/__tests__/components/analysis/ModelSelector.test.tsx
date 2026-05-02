/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/components/analysis/ModelSelector';
import type { AIProvider, ModelId } from '@y0ngha/siglens-core';

jest.mock('@/domain/llm/providerDefaults', () => ({
    resolveDefaultModelForProvider: jest.fn((provider: string) =>
        provider === 'chatgpt' ? null : `${provider}-model`
    ),
}));

const ALLOWED_MODELS: readonly ModelId[] = [
    'claude-sonnet-4-6',
    'gemini-2.5-pro',
] as const;

function renderSelector(
    props: Partial<{
        selectedProvider: AIProvider;
        onProviderChange: (p: AIProvider) => void;
        allowedModels: readonly ModelId[];
        disabled: boolean;
    }> = {}
) {
    const onProviderChange = props.onProviderChange ?? jest.fn();
    return {
        onProviderChange,
        ...render(
            <ModelSelector
                selectedProvider={props.selectedProvider ?? 'claude'}
                onProviderChange={onProviderChange}
                allowedModels={props.allowedModels ?? ALLOWED_MODELS}
                disabled={props.disabled}
            />
        ),
    };
}

describe('ModelSelector', () => {
    it('renders 3 provider options', () => {
        renderSelector();
        const options = screen.getAllByRole('radio');
        expect(options).toHaveLength(3);
    });

    it('selected provider has aria-checked="true", others have aria-checked="false"', () => {
        renderSelector({ selectedProvider: 'gemini' });
        const options = screen.getAllByRole('radio');

        const claudeOption = options.find(
            o => o.getAttribute('data-provider') === 'claude'
        );
        const geminiOption = options.find(
            o => o.getAttribute('data-provider') === 'gemini'
        );
        const chatgptOption = options.find(
            o => o.getAttribute('data-provider') === 'chatgpt'
        );

        expect(claudeOption).toHaveAttribute('aria-checked', 'false');
        expect(geminiOption).toHaveAttribute('aria-checked', 'true');
        expect(chatgptOption).toHaveAttribute('aria-checked', 'false');
    });

    it('clicking an unlocked option calls onProviderChange with correct provider', async () => {
        const user = userEvent.setup();
        const { onProviderChange } = renderSelector({
            selectedProvider: 'claude',
        });

        const geminiOption = screen
            .getAllByRole('radio')
            .find(o => o.getAttribute('data-provider') === 'gemini');

        await user.click(geminiOption!);
        expect(onProviderChange).toHaveBeenCalledWith('gemini');
    });

    it('clicking a locked option does NOT call onProviderChange', async () => {
        const user = userEvent.setup();
        const { onProviderChange } = renderSelector({
            selectedProvider: 'claude',
        });

        const chatgptOption = screen
            .getAllByRole('radio')
            .find(o => o.getAttribute('data-provider') === 'chatgpt');

        await user.click(chatgptOption!);
        expect(onProviderChange).not.toHaveBeenCalled();
    });

    it('ArrowRight moves selection to next option and fires onProviderChange', async () => {
        const user = userEvent.setup();
        const { onProviderChange } = renderSelector({
            selectedProvider: 'claude',
        });

        const claudeOption = screen
            .getAllByRole('radio')
            .find(o => o.getAttribute('data-provider') === 'claude');

        claudeOption!.focus();
        await user.keyboard('{ArrowRight}');

        // next non-locked after claude is gemini (chatgpt is locked)
        expect(onProviderChange).toHaveBeenCalledWith('gemini');
    });

    it('ArrowLeft wraps from first to last non-locked option', async () => {
        const user = userEvent.setup();
        const { onProviderChange } = renderSelector({
            selectedProvider: 'claude',
        });

        const claudeOption = screen
            .getAllByRole('radio')
            .find(o => o.getAttribute('data-provider') === 'claude');

        claudeOption!.focus();
        await user.keyboard('{ArrowLeft}');

        // prev from claude wraps to last non-locked = gemini
        expect(onProviderChange).toHaveBeenCalledWith('gemini');
    });

    it('disabled prop: all clicks are no-ops', async () => {
        const user = userEvent.setup();
        const { onProviderChange } = renderSelector({
            selectedProvider: 'claude',
            disabled: true,
        });

        const options = screen.getAllByRole('radio');
        for (const option of options) {
            await user.click(option);
        }

        expect(onProviderChange).not.toHaveBeenCalled();
    });
});
