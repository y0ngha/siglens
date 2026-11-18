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
import { stubPrefersColorScheme } from '@/shared/test-utils/matchMedia';
import { LOCALES, LOCALE_NATIVE_LABEL } from '@/shared/i18n/locales';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@/shared/lib/theme';

const languageButton = () => screen.getByRole('button', { name: /^언어:/ });
const themeButton = () => screen.getByRole('button', { name: /^테마:/ });

describe('HeaderPreferencesMenu', () => {
    // 주소를 심는 케이스가 뒤 테스트로 새면 쿼리 보존 단언이 항등식이 된다.
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    beforeEach(() => {
        mockReplace.mockClear();
        localStorage.clear();
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
        stubPrefersColorScheme(false);
    });

    it('언어(文A)와 테마(◐)가 각자의 버튼이고, 이름이 현재 선택을 말한다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        renderWithIntl(<HeaderPreferencesMenu />);

        expect(languageButton()).toHaveAccessibleName('언어: 한국어');
        expect(themeButton()).toHaveAccessibleName('테마: 라이트');
    });

    it('닫힌 상태에서는 패널이 DOM에 없고, 트리거는 Disclosure다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);

        for (const button of [languageButton(), themeButton()]) {
            expect(button).toHaveAttribute('aria-expanded', 'false');
            expect(button).not.toHaveAttribute('aria-controls');
            expect(button).not.toHaveAttribute('aria-haspopup');
        }
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('文A는 언어 그룹만, ◐는 테마 그룹만 연다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);

        fireEvent.click(languageButton());
        expect(languageButton()).toHaveAttribute('aria-expanded', 'true');
        expect(
            screen.getByRole('radiogroup', { name: '언어' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('radiogroup', { name: '테마' })
        ).not.toBeInTheDocument();

        fireEvent.click(themeButton());
        expect(
            screen.getByRole('radiogroup', { name: '테마' })
        ).toBeInTheDocument();
    });

    /** 폰 폭에서는 ◐가 헤더 줄을 비우고 드로어로 간다 — 그 경계 클래스를 단다. */
    it('테마 버튼은 폰 폭 경계 미만에서 숨는다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);

        expect(
            themeButton().closest('.max-\\[30rem\\]\\:hidden')
        ).not.toBeNull();
        expect(
            languageButton().closest('.max-\\[30rem\\]\\:hidden')
        ).toBeNull();
    });

    it('지원 로케일 전체를 자국어 표기로 노출한다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        fireEvent.click(languageButton());
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
            screen.getByRole('button', { name: 'Language: English' })
        );
        expect(
            screen.getByRole('radio', { name: '한국어' })
        ).toBeInTheDocument();
    });

    it('언어를 고르면 같은 경로를 새 로케일로 replace하고 패널을 닫는다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        fireEvent.click(languageButton());
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
        fireEvent.click(languageButton());
        fireEvent.click(screen.getByRole('radio', { name: '日本語' }));

        expect(mockReplace).toHaveBeenCalledWith(
            '/AAPL/news?tf=1Hour&sector=tech#chart',
            { locale: 'ja' }
        );
    });

    it('현재 로케일을 다시 고르면 이동하지 않는다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        fireEvent.click(languageButton());
        fireEvent.click(screen.getByRole('radio', { name: '한국어' }));

        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('테마를 고르면 바로 저장하고 패널은 열어 두며, 버튼 이름도 따라 바뀐다', () => {
        renderWithIntl(<HeaderPreferencesMenu />);
        fireEvent.click(themeButton());
        fireEvent.click(screen.getByRole('radio', { name: /다크/ }));

        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        expect(
            screen.getByRole('radiogroup', { name: '테마' })
        ).toBeInTheDocument();
        expect(themeButton()).toHaveAccessibleName('테마: 다크');
    });

    describe('Escape', () => {
        it('패널 안에 포커스가 있으면 닫고 포커스를 트리거로 돌려준다', () => {
            renderWithIntl(<HeaderPreferencesMenu />);
            fireEvent.click(languageButton());
            screen.getByRole('radio', { name: '한국어' }).focus();

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
            expect(languageButton()).toHaveFocus();
        });

        it('포커스가 바깥에 있으면 닫기만 하고 포커스를 가져오지 않는다', () => {
            renderWithIntl(
                <>
                    <HeaderPreferencesMenu />
                    <input aria-label="검색" />
                </>
            );
            fireEvent.click(themeButton());
            const input = screen.getByLabelText('검색');
            input.focus();

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
            expect(input).toHaveFocus();
        });
    });
});
