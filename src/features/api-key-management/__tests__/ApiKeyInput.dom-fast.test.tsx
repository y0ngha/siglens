import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiKeyInput } from '@/features/api-key-management/ui/ApiKeyInput';

describe('ApiKeyInput', () => {
    it('renders password input by default', () => {
        render(<ApiKeyInput name="apiKey" />);
        const passwordInput = document.querySelector(
            'input[name="apiKey"]'
        ) as HTMLInputElement;
        expect(passwordInput).not.toBeNull();
        expect(passwordInput.type).toBe('password');
    });

    it('renders visibility toggle button', () => {
        render(<ApiKeyInput name="apiKey" />);
        expect(
            screen.getByRole('button', { name: 'API 키 보이기' })
        ).toBeInTheDocument();
    });

    it('toggles input type when visibility button is clicked', async () => {
        const user = userEvent.setup();
        render(<ApiKeyInput name="apiKey" />);
        const input = document.querySelector(
            'input[name="apiKey"]'
        ) as HTMLInputElement;

        await user.click(screen.getByRole('button', { name: 'API 키 보이기' }));
        expect(input.type).toBe('text');
        expect(
            screen.getByRole('button', { name: 'API 키 숨기기' })
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'API 키 숨기기' }));
        expect(input.type).toBe('password');
    });

    it('renders with placeholder', () => {
        render(<ApiKeyInput name="apiKey" placeholder="sk-ant-..." />);
        expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument();
    });

    it('renders with aria-label', () => {
        render(<ApiKeyInput name="apiKey" aria-label="Claude API 키" />);
        const input = document.querySelector(
            'input[name="apiKey"]'
        ) as HTMLInputElement;
        expect(input.getAttribute('aria-label')).toBe('Claude API 키');
    });

    it('renders with aria-describedby', () => {
        render(<ApiKeyInput name="apiKey" aria-describedby="status-msg" />);
        const input = document.querySelector(
            'input[name="apiKey"]'
        ) as HTMLInputElement;
        expect(input.getAttribute('aria-describedby')).toBe('status-msg');
    });

    it('sets required attribute', () => {
        render(<ApiKeyInput name="apiKey" />);
        const input = document.querySelector(
            'input[name="apiKey"]'
        ) as HTMLInputElement;
        expect(input.required).toBe(true);
    });

    it('updates aria-pressed on toggle button', async () => {
        const user = userEvent.setup();
        render(<ApiKeyInput name="apiKey" />);
        const button = screen.getByRole('button', { name: 'API 키 보이기' });
        expect(button).toHaveAttribute('aria-pressed', 'false');

        await user.click(button);
        expect(
            screen.getByRole('button', { name: 'API 키 숨기기' })
        ).toHaveAttribute('aria-pressed', 'true');
    });
});
