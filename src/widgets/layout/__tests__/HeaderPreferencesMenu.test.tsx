const { mockReplace, mockPathname } = vi.hoisted(() => ({
    mockReplace: vi.fn(),
    mockPathname: vi.fn(() => '/AAPL/news'),
}));
vi.mock('@/shared/i18n/navigation', () => ({
    usePathname: mockPathname,
    useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

import { fireEvent, screen } from '@testing-library/react';
import { HeaderPreferencesMenu } from '../HeaderPreferencesMenu';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { LOCALES, LOCALE_NATIVE_LABEL } from '@/shared/i18n/locales';
import { THEME_STORAGE_KEY } from '@/shared/lib/theme';

const trigger = () => screen.getByRole('button', { name: '언어 및 테마 설정' });
const open = () => fireEvent.click(trigger());

describe('HeaderPreferencesMenu', () => {
    // 주소를 심는 케이스가 뒤 테스트로 새면 쿼리 보존 단언이 항등식이 된다.
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    beforeEach(() => {
        mockReplace.mockClear();
        localStorage.clear();
    });

    it('닫힌 상태에서는 아이콘 버튼만 있고 패널은 DOM에 없다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);

        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
        expect(trigger()).not.toHaveAttribute('aria-controls');
        expect(trigger()).not.toHaveAttribute('aria-haspopup');
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('열면 언어·테마 두 그룹이 보이는 제목 이름으로 나온다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        open();

        expect(trigger()).toHaveAttribute('aria-expanded', 'true');
        expect(trigger()).toHaveAttribute('aria-controls');
        expect(
            screen.getByRole('radiogroup', { name: '언어' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('radiogroup', { name: '테마' })
        ).toBeInTheDocument();
    });

    it('지원 로케일 전체를 자국어 표기로 노출한다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        open();
        for (const locale of LOCALES) {
            expect(
                screen.getByRole('radio', {
                    name: LOCALE_NATIVE_LABEL[locale],
                })
            ).toBeInTheDocument();
        }
    });

    /** 언어명은 번역 대상이 아니다 — 영어권 사용자가 "영어"를 읽지 못한다. */
    it('언어명은 로케일이 바뀌어도 자국어 표기 그대로다', () => {
        renderWithIntl(<HeaderPreferencesMenu />, { locale: 'en' });
        fireEvent.click(
            screen.getByRole('button', { name: 'Language and theme settings' })
        );
        expect(
            screen.getByRole('radio', { name: '한국어' })
        ).toBeInTheDocument();
    });

    it('언어를 고르면 같은 경로를 새 로케일로 replace하고 패널을 닫는다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        open();
        fireEvent.click(screen.getByRole('radio', { name: '日本語' }));

        expect(mockReplace).toHaveBeenCalledWith('/AAPL/news', {
            locale: 'ja',
        });
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    /**
     * ⚠️ jsdom 기본 주소에는 쿼리·해시가 없어 주소를 심지 않으면 이 케이스는 항등식이다.
     * 보존이 없으면 `/reset-password?token=…`에서 언어를 바꿀 때 토큰이 날아간다.
     */
    it('쿼리스트링과 해시를 유지한 채 로케일만 바꾼다', () => {
        window.history.replaceState(
            null,
            '',
            '/AAPL/news?tf=1Hour&sector=tech#chart'
        );
        renderWithIntl(<HeaderPreferencesMenu />);
        open();
        fireEvent.click(screen.getByRole('radio', { name: '日本語' }));

        expect(mockReplace).toHaveBeenCalledWith(
            '/AAPL/news?tf=1Hour&sector=tech#chart',
            { locale: 'ja' }
        );
    });

    it('현재 로케일을 다시 고르면 이동하지 않는다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        open();
        fireEvent.click(screen.getByRole('radio', { name: '한국어' }));

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('테마를 고르면 바로 저장하고 패널은 열어 둔다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        open();
        fireEvent.click(screen.getByRole('radio', { name: /다크/ }));

        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(
            screen.getByRole('radiogroup', { name: '테마' })
        ).toBeInTheDocument();
    });

    describe('Escape', () => {
        it('패널 안에 포커스가 있으면 닫고 포커스를 트리거로 돌려준다', () => {
            renderWithIntl(<HeaderPreferencesMenu />);
            open();
            screen.getByRole('radio', { name: '한국어' }).focus();

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
            expect(trigger()).toHaveFocus();
        });

        it('포커스가 바깥에 있으면 닫기만 하고 포커스를 가져오지 않는다', () => {
            renderWithIntl(
                <>
                    <HeaderPreferencesMenu />
                    <input aria-label="검색" />
                </>
            );
            open();
            const input = screen.getByLabelText('검색');
            input.focus();

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
            expect(input).toHaveFocus();
        });
    });
});
