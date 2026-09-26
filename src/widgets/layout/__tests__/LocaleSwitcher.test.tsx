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

    it('showLabel이 true면 라벨 span에서 좁은 화면 전용 hidden 클래스를 뺀다', () => {
        renderWithIntl(<LocaleSwitcher showLabel />);
        const label = screen.getByText('한국어', { selector: 'span' });
        expect(label.className).toContain('inline');
        expect(label.className).not.toContain('hidden');
    });

    it('showLabel 기본값(false)은 좁은 화면에서 라벨을 숨긴다', () => {
        renderWithIntl(<LocaleSwitcher />);
        const label = screen.getByText('한국어', { selector: 'span' });
        expect(label.className).toContain('hidden');
        expect(label.className).toContain('sm:inline');
    });

    it('align="start"면 패널을 트리거 왼쪽에 붙인다(left-0)', () => {
        renderWithIntl(<LocaleSwitcher align="start" />);
        open();
        expect(screen.getByRole('radiogroup').className).toContain('left-0');
        expect(screen.getByRole('radiogroup').className).not.toContain(
            'right-0'
        );
    });

    it('align 기본값(end)은 패널을 트리거 오른쪽에 붙인다(right-0)', () => {
        renderWithIntl(<LocaleSwitcher />);
        open();
        expect(screen.getByRole('radiogroup').className).toContain('right-0');
    });

    describe('화살표 키 포커스 이동', () => {
        it('ArrowDown/ArrowRight는 다음 항목으로 포커스를 옮기고 순환한다', () => {
            renderWithIntl(<LocaleSwitcher />);
            open();
            const radios = screen.getAllByRole('radio');
            radios[0]!.focus();
            fireEvent.keyDown(radios[0]!, { key: 'ArrowDown' });
            expect(radios[1]).toHaveFocus();

            fireEvent.keyDown(radios[radios.length - 1]!, {
                key: 'ArrowRight',
            });
            expect(radios[0]).toHaveFocus();
        });

        it('ArrowUp/ArrowLeft는 이전 항목으로 포커스를 옮기고 순환한다', () => {
            renderWithIntl(<LocaleSwitcher />);
            open();
            const radios = screen.getAllByRole('radio');
            radios[0]!.focus();
            fireEvent.keyDown(radios[0]!, { key: 'ArrowUp' });
            expect(radios[radios.length - 1]).toHaveFocus();

            fireEvent.keyDown(radios[1]!, { key: 'ArrowLeft' });
            expect(radios[0]).toHaveFocus();
        });

        it('화살표 이동은 포커스만 옮기고 선택(라우터 replace)까지는 하지 않는다', () => {
            renderWithIntl(<LocaleSwitcher />);
            open();
            const radios = screen.getAllByRole('radio');
            radios[0]!.focus();
            fireEvent.keyDown(radios[0]!, { key: 'ArrowDown' });
            expect(mockReplace).not.toHaveBeenCalled();
        });
    });
});
