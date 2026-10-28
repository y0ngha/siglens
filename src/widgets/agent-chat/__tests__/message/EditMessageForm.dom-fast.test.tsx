import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ko from '../../../../../messages/ko.json';
import { EditMessageForm } from '@/widgets/agent-chat/message/EditMessageForm';
import { MESSAGE_MAX_CHARS } from '@/widgets/agent-chat/utils/messageLimits';

const labels = ko.widgets['agent-chat'].MessageList;

function setup(initialText: string) {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <EditMessageForm
                initialText={initialText}
                onSave={onSave}
                onCancel={onCancel}
            />
        </NextIntlClientProvider>
    );
    const textarea = screen.getByLabelText(labels.e6b008);
    const save = screen.getByRole('button', { name: labels['6523ca'] });
    const cancel = screen.getByRole('button', { name: labels['19b2d1'] });
    return { onSave, onCancel, textarea, save, cancel };
}

describe('EditMessageForm', () => {
    it('starts with the initial text', () => {
        const { textarea } = setup('first question');
        expect(textarea).toHaveValue('first question');
    });

    it('enables save for valid text', () => {
        const { save } = setup('first question');
        expect(save).toBeEnabled();
    });

    it('disables save when the text is cleared', () => {
        const { textarea, save } = setup('first question');
        fireEvent.change(textarea, { target: { value: '' } });
        expect(save).toBeDisabled();
    });

    it('disables save for whitespace-only text', () => {
        const { textarea, save } = setup('first question');
        fireEvent.change(textarea, { target: { value: '  \n  ' } });
        expect(save).toBeDisabled();
    });

    it('enables save at exactly the max length', () => {
        const { textarea, save } = setup('x');
        fireEvent.change(textarea, {
            target: { value: 'a'.repeat(MESSAGE_MAX_CHARS) },
        });
        expect(save).toBeEnabled();
    });

    it('disables save one char over the max length', () => {
        const { textarea, save } = setup('x');
        fireEvent.change(textarea, {
            target: { value: 'a'.repeat(MESSAGE_MAX_CHARS + 1) },
        });
        expect(save).toBeDisabled();
    });

    it('saves the trimmed text', () => {
        const { textarea, save, onSave } = setup('x');
        fireEvent.change(textarea, { target: { value: '  edited  ' } });
        fireEvent.click(save);
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith('edited');
    });

    it('does not save blank text even when the form is submitted directly', () => {
        const { textarea, onSave } = setup('x');
        fireEvent.change(textarea, { target: { value: '   ' } });
        fireEvent.submit(textarea.closest('form') as HTMLFormElement);
        expect(onSave).not.toHaveBeenCalled();
    });

    it('does not save over-limit text even when the form is submitted directly', () => {
        const { textarea, onSave } = setup('x');
        fireEvent.change(textarea, {
            target: { value: 'a'.repeat(MESSAGE_MAX_CHARS + 1) },
        });
        fireEvent.submit(textarea.closest('form') as HTMLFormElement);
        expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onCancel without saving when cancel is clicked', () => {
        const { cancel, onCancel, onSave } = setup('x');
        fireEvent.click(cancel);
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });
});
