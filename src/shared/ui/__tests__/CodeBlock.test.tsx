import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import koMessages from '../../../../messages/ko.json';
import { CodeBlock } from '@/shared/ui/CodeBlock';

const writeText = vi.fn();

function renderBlock() {
    return render(
        <NextIntlClientProvider locale="ko" messages={koMessages}>
            <CodeBlock
                code={'curl -s \\\n  https://x.test'}
                label="curl 예시"
                language="bash"
            />
        </NextIntlClientProvider>
    );
}

describe('CodeBlock', () => {
    beforeEach(() => {
        writeText.mockReset();
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });
    });

    it('renders the code as text inside a named region, with the language tag', () => {
        renderBlock();
        const region = screen.getByRole('region', { name: 'curl 예시' });
        expect(region.tagName).toBe('PRE');
        expect(region.textContent).toBe('curl -s \\\n  https://x.test');
        expect(screen.getByText('bash')).toBeInTheDocument();
    });

    it('makes the scrollable code reachable by keyboard', () => {
        renderBlock();
        expect(
            screen.getByRole('region', { name: 'curl 예시' })
        ).toHaveAttribute('tabindex', '0');
    });

    it('names each copy button after its block so identical buttons stay distinguishable', () => {
        renderBlock();
        expect(
            screen.getByRole('button', { name: '복사: curl 예시' })
        ).toHaveTextContent('복사');
    });

    it('copies the exact code and announces it', async () => {
        writeText.mockResolvedValue(undefined);
        renderBlock();
        await userEvent.click(
            screen.getByRole('button', { name: '복사: curl 예시' })
        );
        expect(writeText).toHaveBeenCalledWith('curl -s \\\n  https://x.test');
        expect(
            await screen.findByRole('button', { name: '복사됨: curl 예시' })
        ).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('복사됨');
    });

    it('shows a failure instead of pretending it copied', async () => {
        writeText.mockRejectedValue(new Error('denied'));
        renderBlock();
        await act(async () => {
            await userEvent.click(
                screen.getByRole('button', { name: '복사: curl 예시' })
            );
        });
        expect(
            await screen.findByRole('button', { name: '복사 실패: curl 예시' })
        ).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('복사 실패');
    });
});
