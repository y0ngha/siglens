import { render, screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import type { RadarRequestFormState } from '@/entities/inquiry/lib/types';
import { useRadarRequestForm } from '@/features/radar-request/hooks/useRadarRequestForm';
import { RadarRequestForm } from '@/features/radar-request/ui/RadarRequestForm';
import { RADAR_REQUEST_SYMBOL_MAX_LENGTH } from '@/shared/config/radar';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import ko from '../../../../messages/ko.json';

// 서버 액션이 끌고 오는 postgres 클라이언트를 jsdom에서 막는다.
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/radar-request/hooks/useRadarRequestForm');
vi.mock('@/entities/auth/hooks/useCurrentUser');

const mockUseRadarRequestForm = vi.mocked(useRadarRequestForm);
const mockUseCurrentUser = vi.mocked(useCurrentUser);
const t = ko.features['radar-request'];

const IDLE_STATE: RadarRequestFormState = {
    submitted: false,
    error: null,
    values: { symbol: '', email: '' },
};

function setFormState(state: RadarRequestFormState) {
    mockUseRadarRequestForm.mockReturnValue([state, vi.fn(), false]);
}

type CurrentUserResult = UseQueryResult<AuthUserRecord | null>;

function currentUser(
    user: AuthUserRecord | null,
    isPending = false
): CurrentUserResult {
    return {
        data: isPending ? undefined : user,
        isPending,
    } as unknown as CurrentUserResult;
}

describe('RadarRequestForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setFormState(IDLE_STATE);
        mockUseCurrentUser.mockReturnValue(currentUser(null));
    });

    it('종목 입력은 필수·최대 길이가 걸리고 이메일은 선택이다', () => {
        render(<RadarRequestForm />);

        const symbol = screen.getByLabelText(t.symbolLabel);
        expect(symbol).toBeRequired();
        expect(symbol).toHaveAttribute(
            'maxlength',
            String(RADAR_REQUEST_SYMBOL_MAX_LENGTH)
        );
        expect(symbol).toHaveAttribute('placeholder', t.symbolPlaceholder);

        const email = screen.getByLabelText(t.emailLabel);
        expect(email).not.toBeRequired();
        expect(email).toHaveAttribute('type', 'email');
        expect(email).toHaveAttribute('autocomplete', 'email');
        expect(screen.getByText(t.emailHint)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: t.submit })
        ).toBeInTheDocument();
    });

    it('로그인 조회가 끝나기 전에는 이메일 입력 대신 스켈레톤을 둔다', () => {
        mockUseCurrentUser.mockReturnValue(currentUser(null, true));
        render(<RadarRequestForm />);

        expect(screen.queryByLabelText(t.emailLabel)).not.toBeInTheDocument();
        expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    it('로그인 조회가 끝나기 전에는 제출 버튼이 막혀 이메일이 빠진 채 제출되지 않는다', () => {
        mockUseCurrentUser.mockReturnValue(currentUser(null, true));
        const { rerender } = render(<RadarRequestForm />);

        expect(screen.getByRole('button', { name: t.submit })).toBeDisabled();

        mockUseCurrentUser.mockReturnValue(currentUser(null));
        rerender(<RadarRequestForm />);

        expect(screen.getByRole('button', { name: t.submit })).toBeEnabled();
        expect(screen.getByLabelText(t.emailLabel)).toBeInTheDocument();
    });

    it('로그인한 사용자의 이메일을 미리 채운다', () => {
        mockUseCurrentUser.mockReturnValue(
            currentUser({
                id: 'u-1',
                email: 'me@example.com',
            } as unknown as AuthUserRecord)
        );
        render(<RadarRequestForm />);

        expect(
            (screen.getByLabelText(t.emailLabel) as HTMLInputElement)
                .defaultValue
        ).toBe('me@example.com');
    });

    it('오류 뒤에는 로그인 이메일 대신 사용자가 친 값을 되살린다', () => {
        mockUseCurrentUser.mockReturnValue(
            currentUser({
                id: 'u-1',
                email: 'me@example.com',
            } as unknown as AuthUserRecord)
        );
        setFormState({
            submitted: false,
            error: { code: 'symbol_required', field: 'symbol' },
            values: { symbol: '', email: 'typed@example.com' },
        });
        render(<RadarRequestForm />);

        expect(
            (screen.getByLabelText(t.emailLabel) as HTMLInputElement)
                .defaultValue
        ).toBe('typed@example.com');
    });

    it('symbol_required 는 종목 필드에 붙고 aria-invalid 가 켜진다', () => {
        setFormState({
            submitted: false,
            error: { code: 'symbol_required', field: 'symbol' },
            values: IDLE_STATE.values,
        });
        render(<RadarRequestForm />);

        expect(screen.getByText(t.errorSymbolRequired)).toBeInTheDocument();
        expect(screen.getByLabelText(t.symbolLabel)).toHaveAttribute(
            'aria-invalid',
            'true'
        );
        expect(screen.getByLabelText(t.emailLabel)).toHaveAttribute(
            'aria-invalid',
            'false'
        );
    });

    it('symbol_too_long 문구에 상수 상한이 들어간다', () => {
        setFormState({
            submitted: false,
            error: { code: 'symbol_too_long', field: 'symbol' },
            values: IDLE_STATE.values,
        });
        render(<RadarRequestForm />);

        expect(
            screen.getByText(
                t.errorSymbolTooLong.replace(
                    '{v0}',
                    String(RADAR_REQUEST_SYMBOL_MAX_LENGTH)
                )
            )
        ).toBeInTheDocument();
    });

    it('email_invalid 는 이메일 필드에 붙는다', () => {
        setFormState({
            submitted: false,
            error: { code: 'email_invalid', field: 'email' },
            values: { symbol: 'PLTR', email: 'x' },
        });
        render(<RadarRequestForm />);

        expect(
            screen.getByText(ko.shared.lib.contactError.emailInvalid)
        ).toBeInTheDocument();
        expect(screen.getByLabelText(t.emailLabel)).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('submission_failed 는 폼 상단 alert 로 보이고 필드 오류는 없다', () => {
        setFormState({
            submitted: false,
            error: { code: 'submission_failed' },
            values: { symbol: 'PLTR', email: '' },
        });
        render(<RadarRequestForm />);

        expect(
            screen.getByText(ko.shared.lib.contactError.submissionFailed)
        ).toBeInTheDocument();
        expect(screen.getByLabelText(t.symbolLabel)).toHaveAttribute(
            'aria-invalid',
            'false'
        );
    });

    it('이메일을 보낸 성공은 이메일 안내 문구를 보이고 폼을 내린다', () => {
        setFormState({
            submitted: true,
            error: null,
            values: { symbol: 'PLTR', email: 'me@example.com' },
        });
        render(<RadarRequestForm />);

        expect(screen.getByText(t.successTitle)).toBeInTheDocument();
        expect(screen.getByText(t.successWithEmail)).toBeInTheDocument();
        expect(
            screen.queryByText(t.successWithoutEmail)
        ).not.toBeInTheDocument();
        expect(screen.queryByLabelText(t.symbolLabel)).not.toBeInTheDocument();
    });

    it('이메일 없이 보낸 성공은 이메일 없는 안내 문구를 보인다', () => {
        setFormState({
            submitted: true,
            error: null,
            values: { symbol: 'PLTR', email: '' },
        });
        render(<RadarRequestForm />);

        expect(screen.getByText(t.successWithoutEmail)).toBeInTheDocument();
        expect(screen.queryByText(t.successWithEmail)).not.toBeInTheDocument();
    });

    it('오류가 오면 첫 오류 필드로 포커스를 옮긴다', () => {
        const { rerender } = render(<RadarRequestForm />);

        setFormState({
            submitted: false,
            error: { code: 'symbol_required', field: 'symbol' },
            values: IDLE_STATE.values,
        });
        rerender(<RadarRequestForm />);

        expect(document.activeElement).toBe(
            screen.getByLabelText(t.symbolLabel)
        );
    });
});
