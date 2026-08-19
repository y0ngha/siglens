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
    beforeEach(() => {
        mockReplace.mockClear();
    });

    it('지원 로케일 전체를 자국어 표기로 노출한다', () => {
        renderWithIntl(<LocaleSwitcher />);
        for (const locale of LOCALES) {
            expect(
                screen.getByRole('option', {
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
        expect(
            screen.getByRole('option', { name: '한국어' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('option', { name: '日本語' })
        ).toBeInTheDocument();
    });

    it('각 옵션에 lang 속성이 붙어 스크린리더가 해당 언어로 읽는다', () => {
        renderWithIntl(<LocaleSwitcher />);
        expect(screen.getByRole('option', { name: '日本語' })).toHaveAttribute(
            'lang',
            'ja'
        );
    });

    it('선택 시 같은 경로를 새 로케일로 replace한다', () => {
        renderWithIntl(<LocaleSwitcher />);
        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'ja' },
        });
        expect(mockReplace).toHaveBeenCalledWith('/AAPL/news', {
            locale: 'ja',
        });
    });

    it('현재 로케일을 다시 고르면 아무 것도 하지 않는다', () => {
        renderWithIntl(<LocaleSwitcher />);
        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'ko' },
        });
        expect(mockReplace).not.toHaveBeenCalled();
    });

    /** 드로어가 닫혀 있을 때 포커스 순서에 남으면 Tab이 보이지 않는 곳으로 샌다. */
    it('tabIndex를 그대로 select에 전달한다', () => {
        renderWithIntl(<LocaleSwitcher tabIndex={-1} />);
        expect(screen.getByRole('combobox', { hidden: true })).toHaveAttribute(
            'tabindex',
            '-1'
        );
    });
});
