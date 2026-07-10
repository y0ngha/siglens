import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiKeySection } from '@/features/api-key-management/ui/ApiKeySection';
import { useApiKeyForms } from '@/features/api-key-management/hooks/useApiKeyForms';
import type { ApiKeyActionState } from '@/shared/lib/types';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/api-key-management/hooks/useApiKeyForms');

const mockUseApiKeyForms = vi.mocked(useApiKeyForms);

const IDLE_STATE: ApiKeyActionState = { status: 'idle', message: null };

function setApiKeyForms(
    saveState: ApiKeyActionState = IDLE_STATE,
    deleteState: ApiKeyActionState = IDLE_STATE
) {
    mockUseApiKeyForms.mockReturnValue({
        saveState,
        saveFormAction: vi.fn(),
        deleteState,
        deleteFormAction: vi.fn(),
    });
}

describe('ApiKeySection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setApiKeyForms();
    });

    it('renders section heading', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        expect(
            screen.getByRole('heading', { name: 'AI 모델 API 키' })
        ).toBeInTheDocument();
    });

    it('renders all four provider cards', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        expect(screen.getByText('Claude (Anthropic)')).toBeInTheDocument();
        expect(screen.getByText('Gemini (Google)')).toBeInTheDocument();
        expect(screen.getByText('ChatGPT (OpenAI)')).toBeInTheDocument();
        expect(screen.getByText('DeepSeek')).toBeInTheDocument();
    });

    it('shows "미등록" badge for unregistered providers', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        const badges = screen.getAllByText('미등록');
        expect(badges).toHaveLength(4);
    });

    it('shows "등록됨" badge for registered providers', () => {
        render(<ApiKeySection registeredProviders={['anthropic']} />);
        expect(screen.getByText('등록됨')).toBeInTheDocument();
        expect(screen.getAllByText('미등록')).toHaveLength(3);
    });

    it('shows save input for unregistered providers', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        const saveButtons = screen.getAllByRole('button', { name: '저장' });
        expect(saveButtons.length).toBeGreaterThan(0);
    });

    it('shows 재등록 and 삭제 buttons for registered providers', () => {
        render(<ApiKeySection registeredProviders={['anthropic', 'google']} />);
        const reRegisterButtons = screen.getAllByRole('button', {
            name: '재등록',
        });
        expect(reRegisterButtons).toHaveLength(2);
        const deleteButtons = screen.getAllByRole('button', { name: '삭제' });
        expect(deleteButtons).toHaveLength(2);
    });

    it('opens save input when 재등록 is clicked', async () => {
        const user = userEvent.setup();
        render(
            <ApiKeySection
                registeredProviders={[
                    'anthropic',
                    'google',
                    'openai',
                    'deepseek',
                ]}
            />
        );

        // All providers start with 재등록 + 삭제 (no save inputs visible)
        expect(screen.queryByRole('button', { name: '저장' })).toBeNull();

        const reRegisterButtons = screen.getAllByRole('button', {
            name: '재등록',
        });
        await user.click(reRegisterButtons[0]);

        expect(
            screen.getByRole('button', { name: '저장' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '취소' })
        ).toBeInTheDocument();
    });

    it('shows success status message for save', () => {
        setApiKeyForms(
            { status: 'success', message: 'API 키가 저장되었습니다.' },
            IDLE_STATE
        );
        render(<ApiKeySection registeredProviders={[]} />);
        expect(
            screen.getAllByText('API 키가 저장되었습니다.').length
        ).toBeGreaterThan(0);
    });

    it('shows error status message for save', () => {
        setApiKeyForms(
            {
                status: 'error',
                message: '저장에 실패했습니다.',
                code: 'unknown',
            },
            IDLE_STATE
        );
        render(<ApiKeySection registeredProviders={[]} />);
        expect(
            screen.getAllByText('저장에 실패했습니다.').length
        ).toBeGreaterThan(0);
    });

    it('renders description text', () => {
        render(<ApiKeySection registeredProviders={[]} />);
        expect(
            screen.getByText(
                '등록한 키는 계정에만 저장되며 안전한 방식으로 암호화됩니다.'
            )
        ).toBeInTheDocument();
    });
});
