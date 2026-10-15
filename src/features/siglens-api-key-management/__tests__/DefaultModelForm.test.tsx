import { render, screen, within } from '@testing-library/react';
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

describe('DefaultModelForm — 키가 있을 때', () => {
    it('등록한 provider의 모델만 provider 그룹으로 보여 주고 "설정 안 함"을 맨 앞에 둔다', () => {
        renderForm();
        const select = screen.getByRole('combobox', { name: '기본 모델' });
        const options = within(select).getAllByRole('option');
        expect(options.map(option => option.textContent)).toEqual([
            '설정 안 함 (요청마다 model 지정)',
            'Claude Opus 5',
            'Claude Opus 5.5',
            'GPT-6 Astra',
        ]);
        expect(
            within(select).getByRole('group', { name: 'Claude (Anthropic)' })
        ).toBeInTheDocument();
        expect(
            within(select).getByRole('group', { name: 'ChatGPT (OpenAI)' })
        ).toBeInTheDocument();
    });

    it('저장된 기본 모델이 선택돼 있다', () => {
        renderForm({ defaultModel: 'gpt-6-astra' });
        expect(screen.getByRole('combobox', { name: '기본 모델' })).toHaveValue(
            'gpt-6-astra'
        );
    });

    it('저장된 값이 없으면 "설정 안 함"(빈 값)이 선택돼 있다', () => {
        renderForm();
        expect(screen.getByRole('combobox', { name: '기본 모델' })).toHaveValue(
            ''
        );
    });

    it('select의 name은 model이다(서버 액션이 읽는 필드)', () => {
        renderForm();
        expect(
            screen.getByRole('combobox', { name: '기본 모델' })
        ).toHaveAttribute('name', 'model');
    });

    it('생성은 BYOK 등급 모델만, 무료·회원 등급은 공유 분석 읽기만 된다고 안내한다', () => {
        renderForm();
        expect(
            screen.getByText(
                /BYOK 등급 모델뿐이에요.*공유 분석만 읽을 수 있어요/
            )
        ).toBeInTheDocument();
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
        renderForm({
            defaultModel: 'gemini-4-argon',
            defaultModelLabel: 'Gemini 4 Argon',
        });
        expect(screen.getByRole('combobox', { name: '기본 모델' })).toHaveValue(
            ''
        );
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
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
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
