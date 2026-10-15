import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiglensApiKeySection } from '@/features/siglens-api-key-management/ui/SiglensApiKeySection';
import {
    useSiglensApiKeyForms,
    type SiglensApiKeyFormsReturn,
} from '@/features/siglens-api-key-management/hooks/useSiglensApiKeyForms';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';

const { formStatus } = vi.hoisted(() => ({
    formStatus: { pending: false },
}));
vi.mock('react-dom', async importOriginal => ({
    ...(await importOriginal<typeof import('react-dom')>()),
    useFormStatus: () => ({
        pending: formStatus.pending,
        data: null,
        method: null,
        action: null,
    }),
}));
vi.mock('@/features/siglens-api-key-management/hooks/useSiglensApiKeyForms');
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

const mockUseForms = vi.mocked(useSiglensApiKeyForms);

const RAW_KEY = `slk_${'Qz8'.repeat(13)}Q`;
const FIRST: SiglensApiKeySummary = {
    id: '33333333-3333-4333-8333-333333333333',
    name: '내 에이전트',
    keyPrefix: 'slk_ab12cd',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    lastUsedAt: null,
};
const SECOND: SiglensApiKeySummary = {
    id: '44444444-4444-4444-8444-444444444444',
    name: '배치 스크립트',
    keyPrefix: 'slk_zz99yy',
    createdAt: new Date('2026-09-20T00:00:00Z'),
    lastUsedAt: new Date('2026-10-10T00:00:00Z'),
};

function setForms(overrides: Partial<SiglensApiKeyFormsReturn> = {}) {
    const forms: SiglensApiKeyFormsReturn = {
        createState: { status: 'idle' },
        createFormAction: vi.fn(),
        revokeState: { status: 'idle' },
        revokeFormAction: vi.fn(),
        ...overrides,
    };
    mockUseForms.mockReturnValue(forms);
    return forms;
}

function renderSection(
    props: Partial<React.ComponentProps<typeof SiglensApiKeySection>> = {}
) {
    return render(
        <SiglensApiKeySection
            keys={[FIRST, SECOND]}
            maxKeys={5}
            emailVerified
            apiBaseUrl="https://example.test/api/v1"
            skillHref="/api/v1/skill"
            {...props}
        />
    );
}

describe('SiglensApiKeySection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        formStatus.pending = false;
        setForms();
    });

    it('섹션 제목을 보여 준다', () => {
        renderSection();
        expect(
            screen.getByRole('heading', { name: '시그렌즈 API', level: 2 })
        ).toBeInTheDocument();
    });

    describe('키 목록', () => {
        it('키마다 이름과 표시용 접두를 보여 준다', () => {
            renderSection();
            expect(screen.getByText('내 에이전트')).toBeInTheDocument();
            expect(screen.getByText('slk_ab12cd…')).toBeInTheDocument();
            expect(screen.getByText('배치 스크립트')).toBeInTheDocument();
            expect(screen.getByText('slk_zz99yy…')).toBeInTheDocument();
        });

        it('사용 기록이 없는 키와 있는 키를 구분해 보여 준다', () => {
            renderSection();
            const first = screen.getByTestId(`siglens-api-key-row-${FIRST.id}`);
            expect(
                within(first).getByText(/아직 사용한 적 없어요/)
            ).toBeInTheDocument();
            const second = screen.getByTestId(
                `siglens-api-key-row-${SECOND.id}`
            );
            expect(within(second).getByText(/마지막 사용/)).toBeInTheDocument();
        });

        it('키가 없으면 빈 상태 문구', () => {
            renderSection({ keys: [] });
            expect(
                screen.getByText('아직 만든 키가 없어요.')
            ).toBeInTheDocument();
        });

        it('목록을 못 불러왔으면 빈 상태가 아니라 오류 문구', () => {
            renderSection({ keys: null });
            expect(screen.getByRole('alert')).toHaveTextContent(
                '키 목록을 불러오지 못했어요'
            );
            expect(
                screen.queryByText('아직 만든 키가 없어요.')
            ).not.toBeInTheDocument();
        });
    });

    describe('새 키 만들기', () => {
        it('이름 입력과 만들기 버튼이 있다', () => {
            renderSection();
            expect(screen.getByLabelText('키 이름')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '새 키 만들기' })
            ).toBeEnabled();
        });

        it('활성 키가 상한이면 만들기 버튼을 막고 안내한다', () => {
            renderSection({ keys: [FIRST, SECOND], maxKeys: 2 });
            expect(
                screen.getByRole('button', { name: '새 키 만들기' })
            ).toBeDisabled();
            expect(
                screen.getByText(/활성 키는 최대 2개까지 만들 수 있어요/)
            ).toBeInTheDocument();
        });

        it('발급 오류 문구를 상태 영역에 보여 준다', () => {
            setForms({
                createState: {
                    status: 'error',
                    code: 'email_not_verified',
                    message: '이메일 인증을 마친 뒤에 API 키를 만들 수 있어요.',
                },
            });
            renderSection();
            expect(
                screen.getByText(
                    '이메일 인증을 마친 뒤에 API 키를 만들 수 있어요.'
                )
            ).toBeInTheDocument();
        });

        it('발급 직후 원문을 한 번 보여 주고 다시 볼 수 없다고 알린다', () => {
            setForms({
                createState: {
                    status: 'created',
                    rawKey: RAW_KEY,
                    keyName: '내 에이전트',
                    keyPrefix: RAW_KEY.slice(0, 10),
                },
            });
            renderSection();
            expect(screen.getByTestId('siglens-api-key-raw')).toHaveTextContent(
                RAW_KEY
            );
            expect(
                screen.getByText(/이 키는 지금만 볼 수 있어요/)
            ).toBeInTheDocument();
        });

        it('"보관했어요"를 누르면 원문이 화면에서 사라진다', async () => {
            const user = userEvent.setup();
            setForms({
                createState: {
                    status: 'created',
                    rawKey: RAW_KEY,
                    keyName: 'n',
                    keyPrefix: RAW_KEY.slice(0, 10),
                },
            });
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '보관했어요' })
            );
            expect(screen.queryByText(RAW_KEY)).not.toBeInTheDocument();
        });

        it('원문 복사 버튼이 클립보드에 키를 쓰고 완료를 알린다', async () => {
            const user = userEvent.setup();
            const writeText = vi.fn().mockResolvedValue(undefined);
            vi.stubGlobal('navigator', {
                ...navigator,
                clipboard: { writeText },
            });
            setForms({
                createState: {
                    status: 'created',
                    rawKey: RAW_KEY,
                    keyName: 'n',
                    keyPrefix: RAW_KEY.slice(0, 10),
                },
            });
            renderSection();
            await user.click(screen.getByRole('button', { name: '복사' }));
            expect(writeText).toHaveBeenCalledWith(RAW_KEY);
            expect(
                await screen.findByRole('button', { name: '복사했어요' })
            ).toBeInTheDocument();
            vi.unstubAllGlobals();
        });

        it('복사에 실패하면 직접 복사하라고 안내한다', async () => {
            const user = userEvent.setup();
            vi.stubGlobal('navigator', {
                ...navigator,
                clipboard: {
                    writeText: vi.fn().mockRejectedValue(new Error('denied')),
                },
            });
            setForms({
                createState: {
                    status: 'created',
                    rawKey: RAW_KEY,
                    keyName: 'n',
                    keyPrefix: RAW_KEY.slice(0, 10),
                },
            });
            renderSection();
            await user.click(screen.getByRole('button', { name: '복사' }));
            expect(await screen.findByRole('alert')).toHaveTextContent(
                '복사하지 못했어요'
            );
            vi.unstubAllGlobals();
        });
    });

    describe('폐기', () => {
        it('폐기를 누르면 확인 단계가 나오고 바로 제출되지 않는다', async () => {
            const user = userEvent.setup();
            const forms = setForms();
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            );
            expect(screen.getByText(/이 키를 폐기할까요/)).toBeInTheDocument();
            expect(forms.revokeFormAction).not.toHaveBeenCalled();
        });

        it('확인 폼은 해당 키의 id를 숨은 필드로 보낸다', async () => {
            const user = userEvent.setup();
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '배치 스크립트 키 폐기' })
            );
            const row = screen.getByTestId(`siglens-api-key-row-${SECOND.id}`);
            const hidden = row.querySelector('input[name="keyId"]');
            expect(hidden).toHaveValue(SECOND.id);
            expect(
                screen.getByRole('button', { name: '폐기하기' })
            ).toBeInTheDocument();
        });

        it('취소하면 확인 단계가 닫힌다', async () => {
            const user = userEvent.setup();
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            );
            await user.click(screen.getByRole('button', { name: '취소' }));
            expect(
                screen.queryByText(/이 키를 폐기할까요/)
            ).not.toBeInTheDocument();
        });

        it('폐기 결과를 알린다', () => {
            setForms({ revokeState: { status: 'revoked' } });
            renderSection();
            expect(screen.getByText('키를 폐기했어요.')).toBeInTheDocument();
        });

        it('폐기 오류 문구를 보여 준다', () => {
            setForms({
                revokeState: {
                    status: 'error',
                    code: 'not_found',
                    message: '이미 폐기됐거나 찾을 수 없는 키예요.',
                },
            });
            renderSection();
            expect(
                screen.getByText('이미 폐기됐거나 찾을 수 없는 키예요.')
            ).toBeInTheDocument();
        });
    });

    describe('30초 시작 가이드', () => {
        it('Skill 내려받기 링크가 파일 이름을 SKILL.md로 지정한다', () => {
            renderSection();
            const link = screen.getByRole('link', { name: 'Skill 내려받기' });
            expect(link).toHaveAttribute('href', '/api/v1/skill');
            expect(link).toHaveAttribute('download', 'SKILL.md');
        });

        it('환경변수 이름과 curl 예시를 보여 준다', () => {
            renderSection();
            expect(
                screen.getByText('export SIGLENS_API_KEY=slk_…')
            ).toBeInTheDocument();
            const curl = screen.getByText(/curl -s -X POST/);
            expect(curl).toHaveTextContent(
                'https://example.test/api/v1/tools/search_ticker'
            );
            expect(curl).toHaveTextContent(
                'Authorization: Bearer $SIGLENS_API_KEY'
            );
        });
    });

    describe('이메일 미인증', () => {
        it('폼을 막고 인증 안내를 먼저 보여 준다', () => {
            renderSection({ emailVerified: false });
            expect(screen.getByLabelText('키 이름')).toBeDisabled();
            expect(
                screen.getByRole('button', { name: '새 키 만들기' })
            ).toBeDisabled();
            expect(
                screen.getByText(
                    /이메일 인증을 마친 뒤에 API 키를 만들 수 있어요/
                )
            ).toBeInTheDocument();
        });

        it('인증된 회원에게는 안내를 보이지 않는다', () => {
            renderSection({ emailVerified: true });
            expect(
                screen.queryByText(/이메일 인증을 마친 뒤에/)
            ).not.toBeInTheDocument();
            expect(screen.getByLabelText('키 이름')).toBeEnabled();
        });
    });

    describe('폐기 포커스 관리(AX-3)', () => {
        it('확인 단계가 열리면 확인 버튼으로 포커스가 옮겨 간다', async () => {
            const user = userEvent.setup();
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            );
            expect(
                screen.getByRole('button', { name: '폐기하기' })
            ).toHaveFocus();
        });

        it('취소하면 폐기 버튼으로 포커스가 돌아온다', async () => {
            const user = userEvent.setup();
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            );
            await user.click(screen.getByRole('button', { name: '취소' }));
            expect(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            ).toHaveFocus();
        });

        it('폐기에 성공하면 남아 있는 상태 영역으로 포커스가 옮겨 간다', () => {
            setForms({ revokeState: { status: 'revoked' } });
            renderSection();
            const region = screen
                .getByText('키를 폐기했어요.')
                .closest('[role="status"]');
            expect(region).toHaveFocus();
        });

        it('진행 중인 버튼은 disabled가 아니라 aria-disabled이고 클릭 기본 동작(제출)을 막는다', async () => {
            const user = userEvent.setup();
            formStatus.pending = true;
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            );
            const confirm = screen.getByRole('button', {
                name: '폐기 중…',
            });
            expect(confirm).toHaveAttribute('aria-disabled', 'true');
            expect(confirm).not.toBeDisabled();
            // fireEvent.click은 기본 동작이 막히면 false를 돌려준다.
            expect(fireEvent.click(confirm)).toBe(false);
        });

        it('진행 중이 아니면 클릭은 막히지 않는다', async () => {
            const user = userEvent.setup();
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            );
            const confirm = screen.getByRole('button', { name: '폐기하기' });
            expect(confirm).not.toHaveAttribute('aria-disabled');
            expect(fireEvent.click(confirm)).toBe(true);
        });
    });
});
