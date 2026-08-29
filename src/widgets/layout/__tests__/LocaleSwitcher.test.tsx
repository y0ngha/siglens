const { mockReplace, mockPathname } = vi.hoisted(() => ({
    mockReplace: vi.fn(),
    mockPathname: vi.fn(() => '/AAPL/news'),
}));
vi.mock('@/shared/i18n/navigation', () => ({
    usePathname: mockPathname,
    useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

import { fireEvent, screen } from '@testing-library/react';
import { LocaleSwitcher } from '../LocaleSwitcher';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { LOCALES, LOCALE_NATIVE_LABEL } from '@/shared/i18n/locales';

describe('LocaleSwitcher', () => {
    // 주소를 심는 케이스가 뒤 테스트로 새면, 쿼리 보존 단언이 다시 항등식이
    // 되는 것을 막던 장치가 순서 하나로 무력해진다.
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    beforeEach(() => {
        mockReplace.mockClear();
    });

    /** 팝오버라 항목은 열기 전에는 DOM에 없다. */
    const open = () => {
        fireEvent.click(screen.getByRole('button', { name: /언어|Language/ }));
    };

    it('지원 로케일 전체를 자국어 표기로 노출한다', () => {
        renderWithIntl(<LocaleSwitcher />);
        open();
        for (const locale of LOCALES) {
            expect(
                screen.getByRole('radio', {
                    name: LOCALE_NATIVE_LABEL[locale],
                })
            ).toBeInTheDocument();
        }
    });

    /**
     * 언어명은 번역 대상이 아니다 — 영어권 사용자가 "영어"를 읽지 못한다.
     * 카탈로그에 들어가면 번역 파이프라인이 이걸 현지어로 바꿔 버린다.
     */
    it('언어명은 로케일이 바뀌어도 자국어 표기 그대로다', () => {
        renderWithIntl(<LocaleSwitcher />, { locale: 'en' });
        open();
        expect(
            screen.getByRole('radio', { name: '한국어' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('radio', { name: '日本語' })
        ).toBeInTheDocument();
    });

    it('각 항목에 lang 속성이 붙어 스크린리더가 해당 언어로 읽는다', () => {
        renderWithIntl(<LocaleSwitcher />);
        open();
        expect(screen.getByRole('radio', { name: '日本語' })).toHaveAttribute(
            'lang',
            'ja'
        );
    });

    /** 선택 표시가 색에만 실리지 않는지 — `aria-checked`가 그 계약이다. */
    it('현재 로케일만 aria-checked다', () => {
        renderWithIntl(<LocaleSwitcher />);
        open();
        expect(screen.getByRole('radio', { name: '한국어' })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(screen.getByRole('radio', { name: '日本語' })).toHaveAttribute(
            'aria-checked',
            'false'
        );
    });

    it('선택 시 같은 경로를 새 로케일로 replace한다', () => {
        renderWithIntl(<LocaleSwitcher />);
        open();
        fireEvent.click(screen.getByRole('radio', { name: '日本語' }));
        expect(mockReplace).toHaveBeenCalledWith('/AAPL/news', {
            locale: 'ja',
        });
    });

    /**
     * ⚠️ **쿼리·해시가 없으면 이 케이스는 아무것도 검증하지 못한다.**
     *
     * jsdom 기본 주소는 `http://localhost:3000/`이라 `search`와 `hash`가 빈
     * 문자열이고, 그러면 `` `${pathname}${query}${hash}` ``가 `pathname`과
     * **글자 그대로 같다**. 실제로 쿼리 보존 수정을 통째로 되돌려도 기존 6개
     * 테스트가 전부 통과했다. 그래서 주소를 직접 심어 판별력을 만든다.
     *
     * 이 보존이 없으면 `/reset-password?token=…`에서 언어를 바꿀 때 토큰이 날아가
     * "링크가 유효하지 않다"가 뜨고, `/signup/oauth/consent?token=…`에서는
     * 진행 중이던 소셜 가입이 취소된다.
     */
    it('쿼리스트링과 해시를 유지한 채 로케일만 바꾼다', () => {
        window.history.replaceState(
            null,
            '',
            '/AAPL/news?tf=1Hour&sector=tech#chart'
        );
        renderWithIntl(<LocaleSwitcher />);
        open();
        fireEvent.click(screen.getByRole('radio', { name: '日本語' }));
        expect(mockReplace).toHaveBeenCalledWith(
            '/AAPL/news?tf=1Hour&sector=tech#chart',
            { locale: 'ja' }
        );
    });

    it('현재 로케일을 다시 고르면 아무 것도 하지 않는다', () => {
        renderWithIntl(<LocaleSwitcher />);
        open();
        fireEvent.click(screen.getByRole('radio', { name: '한국어' }));
        expect(mockReplace).not.toHaveBeenCalled();
    });

    /** 드로어가 닫혀 있을 때 포커스 순서에 남으면 Tab이 보이지 않는 곳으로 샌다. */
    it('tabIndex를 그대로 트리거에 전달한다', () => {
        renderWithIntl(<LocaleSwitcher tabIndex={-1} />);
        expect(
            screen.getByRole('button', { name: /언어|Language/, hidden: true })
        ).toHaveAttribute('tabindex', '-1');
    });
});
