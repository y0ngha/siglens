import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiglensApiKeySection } from '@/features/siglens-api-key-management/ui/SiglensApiKeySection';
import {
    useSiglensApiKeyForms,
    type SiglensApiKeyFormsReturn,
} from '@/features/siglens-api-key-management/hooks/useSiglensApiKeyForms';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';

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

function sectionTree(
    props: Partial<React.ComponentProps<typeof SiglensApiKeySection>> = {}
) {
    return (
        <>
            {/* 계정 페이지의 BYOK 섹션 자리(안내 모달이 스크롤·포커스하는 대상). */}
            <section id="byok-keys" tabIndex={-1} aria-label="byok" />
            <SiglensApiKeySection
                keys={[FIRST, SECOND]}
                maxKeys={5}
                emailVerified
                hasByokKey
                byokSectionId="byok-keys"
                apiBaseUrl="https://example.test/api/v1"
                skillHref="/api/v1/skill"
                {...props}
            />
        </>
    );
}

function renderSection(
    props: Partial<React.ComponentProps<typeof SiglensApiKeySection>> = {}
) {
    return render(sectionTree(props));
}

const CREATED: SiglensApiKeyFormsReturn['createState'] = {
    status: 'created',
    rawKey: RAW_KEY,
    keyName: '내 에이전트',
    keyPrefix: RAW_KEY.slice(0, 10),
};

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

    it('개발자 포털(/developers)로 가는 링크를 보여 준다', () => {
        renderSection();
        expect(
            screen.getByRole('link', { name: 'API 문서 보기' })
        ).toHaveAttribute('href', '/developers');
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
            const { rerender } = renderSection();
            setForms({ revokeState: { status: 'revoked' } });
            rerender(sectionTree());
            const region = screen
                .getByText('키를 폐기했어요.')
                .closest('[role="status"]');
            expect(region).toHaveFocus();
        });

        it('확인 버튼은 되돌릴 수 없다는 경고 문구를 설명으로 읽힌다', async () => {
            const user = userEvent.setup();
            renderSection();
            await user.click(
                screen.getByRole('button', { name: '내 에이전트 키 폐기' })
            );
            expect(
                screen.getByRole('button', { name: '폐기하기' })
            ).toHaveAccessibleDescription(
                '이 키를 폐기할까요? 이 키로 하던 호출은 바로 막히고 되돌릴 수 없어요.'
            );
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

describe('SiglensApiKeySection — API 기본 모델 영역', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        formStatus.pending = false;
        setForms();
    });

    it('defaultModelSlot을 키 목록과 시작 가이드 사이에 그린다', () => {
        renderSection({
            defaultModelSlot: <div data-testid="slot">기본 모델 영역</div>,
        });
        const slot = screen.getByTestId('slot');
        const guide = screen.getByRole('heading', { name: '30초 시작 가이드' });
        const list = screen.getByRole('list', { name: '발급한 API 키 목록' });
        expect(
            list.compareDocumentPosition(slot) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
            slot.compareDocumentPosition(guide) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('slot이 없으면 아무것도 더하지 않는다', () => {
        renderSection();
        expect(screen.queryByTestId('slot')).not.toBeInTheDocument();
    });
});

describe('SiglensApiKeySection — BYOK 키가 없을 때 발급 확인', () => {
    const scrollIntoView = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        formStatus.pending = false;
        Element.prototype.scrollIntoView = scrollIntoView;
    });

    async function clickCreate(user: ReturnType<typeof userEvent.setup>) {
        await user.type(screen.getByLabelText('키 이름'), '내 키');
        await user.click(screen.getByRole('button', { name: '새 키 만들기' }));
    }

    function createdNames(form: SiglensApiKeyFormsReturn): unknown[] {
        return vi
            .mocked(form.createFormAction)
            .mock.calls.map(([data]) => data.get('name'));
    }

    it('BYOK 키가 없으면 버튼 근처에 안내를 미리 보여 준다', () => {
        setForms();
        renderSection({ hasByokKey: false });
        expect(
            screen.getByText(/등록된 AI 모델 키\(BYOK\)가 없어요/)
        ).toBeInTheDocument();
    });

    it('BYOK 키가 있으면 안내도 모달도 없다', async () => {
        const user = userEvent.setup();
        const form = setForms();
        renderSection({ hasByokKey: true });
        expect(
            screen.queryByText(/등록된 AI 모델 키\(BYOK\)가 없어요/)
        ).not.toBeInTheDocument();

        await clickCreate(user);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(createdNames(form)).toContain('내 키');
    });

    it('BYOK 키가 없으면 모달이 열리고 발급은 아직 일어나지 않는다', async () => {
        const user = userEvent.setup();
        const form = setForms();
        renderSection({ hasByokKey: false });
        await clickCreate(user);

        const dialog = screen.getByRole('dialog', {
            name: 'AI 모델 키를 먼저 등록해 주세요',
        });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleDescription(
            /내가 등록한 LLM 키\(BYOK\)로만 만들어져요/
        );
        expect(dialog).toHaveFocus();
        expect(form.createFormAction).not.toHaveBeenCalled();
    });

    it('"AI 모델 키 등록하러 가기"는 모달을 닫고 BYOK 섹션으로 스크롤·포커스하며 발급하지 않는다', async () => {
        const user = userEvent.setup();
        const form = setForms();
        renderSection({ hasByokKey: false });
        await clickCreate(user);
        await user.click(
            screen.getByRole('button', { name: 'AI 모델 키 등록하러 가기' })
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(document.getElementById('byok-keys')).toHaveFocus();
        expect(scrollIntoView).toHaveBeenCalled();
        expect(form.createFormAction).not.toHaveBeenCalled();
    });

    it('"데이터 도구만 쓸게요, 키 만들기"는 입력한 이름으로 그대로 발급한다', async () => {
        const user = userEvent.setup();
        const form = setForms();
        renderSection({ hasByokKey: false });
        await clickCreate(user);
        await user.click(
            screen.getByRole('button', {
                name: '데이터 도구만 쓸게요, 키 만들기',
            })
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(createdNames(form)).toEqual(['내 키']));
    });

    it('Escape는 발급 없이 취소하고 포커스를 발급 버튼으로 돌린다', async () => {
        const user = userEvent.setup();
        const form = setForms();
        renderSection({ hasByokKey: false });
        await clickCreate(user);
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(form.createFormAction).not.toHaveBeenCalled();
        expect(
            screen.getByRole('button', { name: '새 키 만들기' })
        ).toHaveFocus();
    });

    it('닫기 버튼도 발급 없이 취소한다', async () => {
        const user = userEvent.setup();
        const form = setForms();
        renderSection({ hasByokKey: false });
        await clickCreate(user);
        await user.click(screen.getByRole('button', { name: '닫기' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(form.createFormAction).not.toHaveBeenCalled();
    });

    it('모달이 닫힌 뒤 다시 발급하면 모달이 다시 열린다(확인은 한 번만 통과)', async () => {
        const user = userEvent.setup();
        setForms();
        renderSection({ hasByokKey: false });
        await clickCreate(user);
        await user.click(
            screen.getByRole('button', {
                name: '데이터 도구만 쓸게요, 키 만들기',
            })
        );
        await user.click(screen.getByRole('button', { name: '새 키 만들기' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('제출을 못 하면(requestSubmit 불발) 우회가 무장된 채 남지 않아 다음 발급은 다시 모달을 연다', async () => {
        const user = userEvent.setup();
        const form = setForms();
        const { container } = renderSection({ hasByokKey: false });
        await clickCreate(user);
        // 인스턴스에 덮어써 이 폼의 프로그램 제출만 불발로 만든다(제출 이벤트가 일어나지 않는다).
        const requestSubmit = vi.fn();
        const formEl = container.querySelector('form');
        if (formEl === null) throw new Error('발급 폼이 없다');
        formEl.requestSubmit = requestSubmit;
        await user.click(
            screen.getByRole('button', {
                name: '데이터 도구만 쓸게요, 키 만들기',
            })
        );
        await waitFor(() => expect(requestSubmit).toHaveBeenCalledTimes(1));
        expect(form.createFormAction).not.toHaveBeenCalled();
        // jsdom은 제출 버튼 클릭도 이 메서드를 거치므로, 다음 클릭 전에 원래 동작으로 되돌린다.
        Reflect.deleteProperty(formEl, 'requestSubmit');

        await user.click(screen.getByRole('button', { name: '새 키 만들기' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(form.createFormAction).not.toHaveBeenCalled();
    });
});

describe('SiglensApiKeySection — 새 키 원문 노출', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        formStatus.pending = false;
        setForms();
    });

    it('보관하기 전에 다시 낸 발급이 실패해도 앞 키의 원문은 남는다', () => {
        setForms({ createState: CREATED });
        const { rerender } = renderSection();
        setForms({
            createState: {
                status: 'error',
                code: 'invalid_name',
                message: '키 이름을 확인해 주세요.',
            },
        });
        rerender(sectionTree());
        expect(screen.getByTestId('siglens-api-key-raw')).toHaveTextContent(
            RAW_KEY
        );
        expect(
            screen.getByText('키 이름을 확인해 주세요.')
        ).toBeInTheDocument();
    });

    it('새 키를 또 만들면 그 원문으로 바뀐다', () => {
        const nextRawKey = `slk_${'Wp4'.repeat(13)}W`;
        setForms({ createState: CREATED });
        const { rerender } = renderSection();
        setForms({
            createState: { ...CREATED, rawKey: nextRawKey },
        });
        rerender(sectionTree());
        expect(screen.getByTestId('siglens-api-key-raw')).toHaveTextContent(
            nextRawKey
        );
    });

    it('발급에 성공하면 원문 패널로 포커스가 옮겨 간다', () => {
        const { rerender } = renderSection();
        setForms({ createState: CREATED });
        rerender(sectionTree());
        expect(screen.getByTestId('siglens-api-key-revealed')).toHaveFocus();
    });

    it('"보관했어요"를 누르면 포커스가 키 이름 입력칸으로 간다', async () => {
        const user = userEvent.setup();
        setForms({ createState: CREATED });
        renderSection();
        await user.click(screen.getByRole('button', { name: '보관했어요' }));
        expect(screen.getByLabelText('키 이름')).toHaveFocus();
    });
});

describe('SiglensApiKeySection — 발급 오류 연결', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        formStatus.pending = false;
    });

    it('이름 오류면 입력칸이 aria-invalid다', () => {
        setForms({
            createState: {
                status: 'error',
                code: 'invalid_name',
                message: '키 이름을 확인해 주세요.',
            },
        });
        renderSection();
        expect(screen.getByLabelText('키 이름')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('이름과 무관한 오류면 입력칸에 aria-invalid가 없다', () => {
        setForms({
            createState: {
                status: 'error',
                code: 'server_error',
                message: '잠시 후 다시 시도해 주세요.',
            },
        });
        renderSection();
        expect(screen.getByLabelText('키 이름')).not.toHaveAttribute(
            'aria-invalid'
        );
    });
});

describe('SiglensApiKeySection — 제목 위계(DS-4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setForms();
    });

    it('섹션 제목은 h2 공유 토큰을 쓴다', () => {
        renderSection();
        expect(
            screen.getByRole('heading', { name: '시그렌즈 API', level: 2 })
        ).toHaveClass(...HEADING_SECTION.split(' '));
    });

    it('시작 가이드 제목은 h3 공유 토큰을 쓴다', () => {
        renderSection();
        expect(
            screen.getByRole('heading', { name: '30초 시작 가이드', level: 3 })
        ).toHaveClass(...HEADING_SUBSECTION.split(' '));
    });
});

describe('SiglensApiKeySection — 시작 가이드 텍스트', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setForms();
    });

    it('1단계 문장과 export 명령 사이에 실제 공백이 있다', () => {
        renderSection();
        const step = screen.getByText(
            'export SIGLENS_API_KEY=slk_…'
        ).parentElement;
        expect(step?.textContent).toBe(
            '위에서 키를 만든 뒤 환경변수에 저장해요. export SIGLENS_API_KEY=slk_…'
        );
    });
});
