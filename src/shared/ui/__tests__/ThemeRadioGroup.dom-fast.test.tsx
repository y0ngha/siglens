import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeRadioGroup } from '../ThemeRadioGroup';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { stubPrefersColorScheme } from '@/shared/test-utils/matchMedia';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@/shared/lib/theme';

/**
 * 테마 선택은 **두 축**을 갖는다 — 사용자가 무엇을 골랐는가(`preference`)와
 * 실제로 무엇이 칠해지는가(`<html data-theme>`). 둘은 같지 않다: `시스템 설정`을
 * 고른 사용자와 `다크`를 고른 사용자는 OS가 다크일 때 화면이 **완전히 동일**하다.
 *
 * 그래서 이 테스트는 화면 색이 아니라 **선택 표시**와 **저장 형태**를 본다.
 */

function renderGroup() {
    return renderWithIntl(
        <>
            <p id="theme-heading">테마</p>
            <ThemeRadioGroup labelledBy="theme-heading" />
        </>
    );
}

function radios(): HTMLElement[] {
    return screen.getAllByRole('radio');
}

function radioAt(index: number): HTMLElement {
    const radio = radios()[index];
    if (radio === undefined) throw new Error(`radio ${index} not found`);
    return radio;
}

describe('ThemeRadioGroup', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
        stubPrefersColorScheme(false);
    });

    it('세 가지 선택지를 라디오로 노출한다', () => {
        renderGroup();

        expect(radios().map(r => r.textContent?.trim())).toEqual([
            '시스템 설정',
            '라이트',
            '다크',
        ]);
    });

    it('그룹의 접근 이름은 보이는 제목에서 온다', () => {
        renderGroup();

        expect(
            screen.getByRole('radiogroup', { name: '테마' })
        ).toBeInTheDocument();
    });

    it('저장값이 없으면 시스템 설정이 선택돼 있다', () => {
        renderGroup();

        expect(
            screen.getByRole('radio', { name: /시스템 설정/ })
        ).toHaveAttribute('aria-checked', 'true');
    });

    it('저장된 선택을 그대로 표시한다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        renderGroup();

        expect(screen.getByRole('radio', { name: /라이트/ })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(
            screen.getByRole('radio', { name: /시스템 설정/ })
        ).toHaveAttribute('aria-checked', 'false');
    });

    it('명시적 선택은 저장하고, 시스템 설정은 키를 지운다', () => {
        renderGroup();

        fireEvent.click(screen.getByRole('radio', { name: /다크/ }));
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

        fireEvent.click(screen.getByRole('radio', { name: /시스템 설정/ }));
        // `system`은 값으로 저장하지 않는다 — 키의 부재가 곧 그 선택이다.
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('시스템 설정을 고르면 시스템 선호도가 화면에 적용된다', () => {
        stubPrefersColorScheme(true); // OS = light
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        renderGroup();

        fireEvent.click(screen.getByRole('radio', { name: /시스템 설정/ }));

        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'light'
        );
    });

    it('고른 뒤에도 그룹이 남아 결과를 바로 비교할 수 있다', () => {
        renderGroup();

        fireEvent.click(screen.getByRole('radio', { name: /라이트/ }));

        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    /** WAI-ARIA APG의 라디오 그룹은 **단일 탭 스톱**이다. */
    it('선택된 항목만 탭 스톱이다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        renderGroup();

        expect(radios().map(r => r.getAttribute('tabindex'))).toEqual([
            '-1',
            '-1',
            '0',
        ]);
    });

    it('ArrowDown/ArrowRight로 포커스와 선택이 함께 옮겨가고 끝에서 순환한다', () => {
        renderGroup(); // 저장값 없음 → system(0번)이 선택

        fireEvent.keyDown(radioAt(0), { key: 'ArrowDown' });
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
        expect(radioAt(1)).toHaveFocus();

        fireEvent.keyDown(radioAt(2), { key: 'ArrowRight' });
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('ArrowUp/ArrowLeft도 이전 항목으로 옮기고 처음에서 순환한다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        renderGroup();

        fireEvent.keyDown(radioAt(2), { key: 'ArrowUp' });
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

        fireEvent.keyDown(radioAt(0), { key: 'ArrowLeft' });
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('화살표가 아닌 키는 가로채지 않는다', () => {
        renderGroup();

        const notPrevented = fireEvent.keyDown(radioAt(0), { key: 'a' });

        expect(notPrevented).toBe(true);
    });

    it('알 수 없는 저장값이면 시스템 설정(첫 옵션)으로 대체한다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'not-a-real-theme');
        renderGroup();

        expect(
            screen.getByRole('radio', { name: /시스템 설정/ })
        ).toHaveAttribute('aria-checked', 'true');
    });
});
