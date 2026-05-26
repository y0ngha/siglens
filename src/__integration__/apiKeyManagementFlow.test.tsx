import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiKeySection } from '@/features/api-key-management/ui/ApiKeySection';
import type { ApiKeyActionState } from '@/entities/api-key/lib/types';
import type { LlmProvider } from '@/entities/api-key/lib/constants';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/account',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/entities/api-key', () => ({
    LLM_PROVIDER_VALUES: ['anthropic', 'google', 'openai'] as LlmProvider[],
}));

vi.mock('@/shared/lib/llmProviderLabels', () => ({
    LLM_PROVIDER_LABELS: {
        anthropic: 'Anthropic',
        google: 'Google Gemini',
        openai: 'OpenAI',
    },
}));

const idleState: ApiKeyActionState = { status: 'idle', message: null };
const mockSaveFormAction = vi.fn();
const mockDeleteFormAction = vi.fn();

vi.mock('@/features/api-key-management/hooks/useApiKeyForms', () => ({
    useApiKeyForms: () => ({
        saveState: idleState,
        saveFormAction: mockSaveFormAction,
        deleteState: idleState,
        deleteFormAction: mockDeleteFormAction,
    }),
}));

describe('API Key Management Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all provider cards', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        expect(screen.getByText('Anthropic')).toBeInTheDocument();
        expect(screen.getByText('Google Gemini')).toBeInTheDocument();
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });

    it('shows unregistered badge for providers without keys', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        const badges = screen.getAllByText('미등록');
        expect(badges).toHaveLength(3);
    });

    it('shows registered badge for providers with keys', () => {
        render(
            <ApiKeySection
                registeredProviders={['anthropic'] as LlmProvider[]}
            />
        );
        expect(screen.getByText('등록됨')).toBeInTheDocument();
    });

    it('shows save form for unregistered providers', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        const saveButtons = screen.getAllByRole('button', { name: '저장' });
        expect(saveButtons.length).toBeGreaterThan(0);
    });

    it('shows re-register and delete buttons for registered providers', () => {
        render(
            <ApiKeySection
                registeredProviders={['anthropic'] as LlmProvider[]}
            />
        );
        expect(screen.getByText('재등록')).toBeInTheDocument();
        expect(screen.getByText('삭제')).toBeInTheDocument();
    });

    it('opens save form when re-register button is clicked', async () => {
        render(
            <ApiKeySection
                registeredProviders={['anthropic'] as LlmProvider[]}
            />
        );
        const user = userEvent.setup();
        await user.click(screen.getByText('재등록'));
        const saveButtons = screen.getAllByRole('button', { name: '저장' });
        expect(saveButtons.length).toBeGreaterThan(0);
    });
});
