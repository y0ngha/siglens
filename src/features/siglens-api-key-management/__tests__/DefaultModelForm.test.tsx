import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DefaultModelForm } from '@/features/siglens-api-key-management/ui/DefaultModelForm';
import {
    useApiDefaultModelForm,
    type ApiDefaultModelFormReturn,
} from '@/features/siglens-api-key-management/hooks/useApiDefaultModelForm';
import type { ApiModelOptionGroup } from '@/features/siglens-api-key-management/lib/buildApiModelOptions';

vi.mock('react-dom', async importOriginal => ({
    ...(await importOriginal<typeof import('react-dom')>()),
    useFormStatus: () => ({
        pending: false,
        data: null,
        method: null,
        action: null,
    }),
}));
vi.mock('@/features/siglens-api-key-management/hooks/useApiDefaultModelForm');
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

const mockUseForm = vi.mocked(useApiDefaultModelForm);

const ANTHROPIC: ApiModelOptionGroup = {
    provider: 'anthropic',
    providerLabel: 'Claude (Anthropic)',
    options: [
        { id: 'claude-opus-5', label: 'Claude Opus 5' },
        { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    ],
};
const OPENAI: ApiModelOptionGroup = {
    provider: 'openai',
    providerLabel: 'ChatGPT (OpenAI)',
    options: [{ id: 'gpt-6-astra', label: 'GPT-6 Astra' }],
};

function setForm(overrides: Partial<ApiDefaultModelFormReturn> = {}) {
    const form: ApiDefaultModelFormReturn = {
        state: { status: 'idle' },
        formAction: vi.fn(),
        ...overrides,
    };
    mockUseForm.mockReturnValue(form);
    return form;
}

function renderForm(
    props: Partial<React.ComponentProps<typeof DefaultModelForm>> = {}
) {
    return render(
        <DefaultModelForm
            defaultModel={null}
            groups={[ANTHROPIC, OPENAI]}
            defaultModelLabel={null}
            byokHref="#byok-keys"
            keyProviderLabels="Claude (Anthropic), Gemini (Google)"
            {...props}
        />
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    setForm();
});

const TRIGGER_NAME = '기본 모델';

function getTrigger() {
    return screen.getByRole('button', { name: new RegExp(TRIGGER_NAME) });
}

function getHiddenModelValue(container: HTMLElement): string | undefined {
    return container.querySelector<HTMLInputElement>('input[name="model"]')
        ?.value;
}

describe('DefaultModelForm — 키가 있을 때', () => {
    it('열기 전에는 목록이 없고 트리거가 listbox를 연다고 알린다', () => {
        renderForm();
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(getTrigger()).toHaveAttribute('aria-haspopup', 'listbox');
        expect(getTrigger()).toHaveAttribute('aria-expanded', 'false');
    });

    it('열면 "설정 안 함"이 맨 앞이고 등록한 provider의 모델만 provider 그룹으로 나온다', async () => {
        const user = userEvent.setup();
        renderForm();
        await user.click(getTrigger());

        const listbox = screen.getByRole('listbox', { name: '기본 모델' });
        expect(
            within(listbox)
                .getAllByRole('option')
                .map(option => option.textContent)
        ).toEqual([
            expect.stringContaining('설정 안 함 (요청마다 model 지정)'),
            expect.stringContaining('Claude Opus 5'),
            expect.stringContaining('Claude Opus 5.5'),
            expect.stringContaining('GPT-6 Astra'),
        ]);
        const anthropic = within(listbox).getByRole('group', {
            name: 'Claude (Anthropic)',
        });
        expect(within(anthropic).getAllByRole('option')).toHaveLength(2);
        expect(
            within(listbox).getByRole('group', { name: 'ChatGPT (OpenAI)' })
        ).toBeInTheDocument();
        // API에서는 모든 모델이 내 키로 돌아 등급 배지를 보이지 않는다.
        expect(listbox.textContent).not.toMatch(/MEMBER|BYOK/);
    });

    it('저장된 기본 모델이 트리거에 보이고 열면 그 항목이 선택돼 있다', async () => {
        const user = userEvent.setup();
        const { container } = renderForm({ defaultModel: 'gpt-6-astra' });
        expect(getTrigger()).toHaveTextContent('GPT-6 Astra');
        expect(getHiddenModelValue(container)).toBe('gpt-6-astra');

        await user.click(getTrigger());
        expect(
            screen.getByRole('option', { selected: true })
        ).toHaveTextContent('GPT-6 Astra');
    });

    it('저장된 값이 없으면 "설정 안 함"이 보이고 제출 값은 빈 문자열이다', () => {
        const { container } = renderForm();
        expect(getTrigger()).toHaveTextContent(
            '설정 안 함 (요청마다 model 지정)'
        );
        expect(getHiddenModelValue(container)).toBe('');
    });

    it('항목을 고르면 닫히고 포커스가 트리거로 돌아가며 제출 값이 바뀐다', async () => {
        const user = userEvent.setup();
        const { container } = renderForm();
        await user.click(getTrigger());
        await user.click(screen.getByRole('option', { name: /GPT-6 Astra/ }));

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(getTrigger()).toHaveFocus();
        expect(getTrigger()).toHaveTextContent('GPT-6 Astra');
        expect(getHiddenModelValue(container)).toBe('gpt-6-astra');
    });

    it('키보드로 고른다: 열면 선택 항목에 포커스, 방향키로 옮기고 Enter로 확정', async () => {
        const user = userEvent.setup();
        const { container } = renderForm({ defaultModel: 'claude-opus-5' });
        await user.click(getTrigger());
        expect(screen.getByRole('option', { selected: true })).toHaveFocus();

        await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(getHiddenModelValue(container)).toBe('gpt-6-astra');
        expect(getTrigger()).toHaveFocus();
    });

    it('"설정 안 함"을 고르면 제출 값이 빈 문자열로 돌아온다', async () => {
        const user = userEvent.setup();
        const { container } = renderForm({ defaultModel: 'claude-opus-5' });
        await user.click(getTrigger());
        await user.click(screen.getByRole('option', { name: /설정 안 함/ }));

        expect(getHiddenModelValue(container)).toBe('');
        expect(getTrigger()).toHaveTextContent('설정 안 함');
    });

    it('Escape는 선택을 바꾸지 않고 닫는다', async () => {
        const user = userEvent.setup();
        const { container } = renderForm({ defaultModel: 'claude-opus-5' });
        await user.click(getTrigger());
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(getHiddenModelValue(container)).toBe('claude-opus-5');
        expect(getTrigger()).toHaveFocus();
    });

    it('폼 제출 시 선택한 모델이 model 필드로 서버 액션에 실린다', async () => {
        const user = userEvent.setup();
        const form = setForm();
        const { container } = renderForm();
        await user.click(getTrigger());
        await user.click(
            screen.getByRole('option', { name: /Claude Opus 5.5/ })
        );
        await user.click(screen.getByRole('button', { name: '저장' }));

        await waitFor(() => expect(form.formAction).toHaveBeenCalled());
        const submitted = vi
            .mocked(form.formAction)
            .mock.calls.map(([data]) => data.get('model'));
        expect(submitted).toContain('claude-opus-5-5');
        expect(getHiddenModelValue(container)).toBe('claude-opus-5-5');
    });

    it('등급과 상관없이 모든 모델을 내 키로 만들 수 있다고 안내한다', () => {
        renderForm();
        expect(
            screen.getByText(/모든 모델로 새 분석을 만들 수 있어요/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/BYOK 등급 모델뿐/)).not.toBeInTheDocument();
    });

    it('저장 버튼이 있고 BYOK 안내 링크는 없다', () => {
        renderForm();
        expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('저장 성공 상태를 알린다', () => {
        setForm({ state: { status: 'saved', model: 'claude-opus-5' } });
        renderForm({ defaultModel: 'claude-opus-5' });
        expect(screen.getByRole('status')).toHaveTextContent(
            '기본 모델을 저장했어요.'
        );
    });

    it('해제(model: null) 성공은 다른 문구로 알린다', () => {
        setForm({ state: { status: 'saved', model: null } });
        renderForm();
        expect(screen.getByRole('status')).toHaveTextContent(
            '기본 모델 설정을 해제했어요.'
        );
    });

    it('서버가 거절하면 그 메시지를 상태 영역에 보여 준다', () => {
        setForm({
            state: {
                status: 'error',
                code: 'provider_key_missing',
                message: '이 모델 회사의 BYOK 키를 먼저 등록해 주세요.',
            },
        });
        renderForm();
        expect(screen.getByRole('status')).toHaveTextContent(
            '이 모델 회사의 BYOK 키를 먼저 등록해 주세요.'
        );
    });

    it('저장된 모델이 선택지에 없으면(키를 지운 뒤) 안내하고 "설정 안 함"으로 보여 준다', () => {
        const { container } = renderForm({
            defaultModel: 'gemini-4-argon',
            defaultModelLabel: 'Gemini 4 Argon',
        });
        expect(getHiddenModelValue(container)).toBe('');
        expect(getTrigger()).toHaveTextContent('설정 안 함');
        expect(screen.getByRole('status')).toHaveTextContent(
            '저장된 기본 모델(Gemini 4 Argon)을 지금은 쓸 수 없어요.'
        );
    });
});

describe('DefaultModelForm — 키가 없을 때', () => {
    beforeEach(() => {
        renderForm({ groups: [] });
    });

    it('선택기 없이 BYOK 섹션으로 가는 링크를 보여 준다', () => {
        expect(
            screen.queryByRole('button', { name: new RegExp(TRIGGER_NAME) })
        ).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
        expect(
            screen.getByRole('link', { name: 'AI 모델 API 키 등록하러 가기' })
        ).toHaveAttribute('href', '#byok-keys');
    });

    it('안내 문구에 키를 등록할 수 있는 회사 목록을 인자로 주입한다', () => {
        expect(
            screen.getByText(
                /직접 만들 수 있는 모델이 아직 없어요. Claude \(Anthropic\), Gemini \(Google\) 중 하나의 BYOK 키를/
            )
        ).toBeInTheDocument();
    });
});
