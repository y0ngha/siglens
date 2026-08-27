import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeToggle } from '../ThemeToggle';
import { stubPrefersColorScheme } from '@/shared/test-utils/matchMedia';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from '@/shared/lib/theme';

/**
 * 테마 선택은 **두 축**을 갖는다 — 사용자가 무엇을 골랐는가(`preference`)와
 * 실제로 무엇이 칠해지는가(`<html data-theme>`). 둘은 같지 않다: `설정 따라가기`를
 * 고른 사용자와 `다크`를 고른 사용자는 OS가 다크일 때 화면이 **완전히 동일**하다.
 *
 * 그래서 이 테스트는 화면 색이 아니라 **선택 표시**와 **저장 형태**를 본다.
 * 색만 보는 테스트는 두 상태를 구분하지 못해 회귀를 놓친다.
 */

function openMenu(): void {
    fireEvent.click(screen.getByRole('button', { name: /테마:/ }));
}

describe('ThemeToggle', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute(THEME_ATTRIBUTE);
        stubPrefersColorScheme(false);
    });

    it('세 가지 선택지를 라디오로 노출한다', () => {
        render(<ThemeToggle />);
        openMenu();

        expect(
            screen.getAllByRole('radio').map(r => r.textContent?.trim())
        ).toEqual(['설정 따라가기', '라이트', '다크']);
    });

    it('저장값이 없으면 설정 따라가기가 선택돼 있다', () => {
        render(<ThemeToggle />);
        openMenu();

        expect(
            screen.getByRole('radio', { name: /설정 따라가기/ })
        ).toHaveAttribute('aria-checked', 'true');
    });

    it('저장된 선택을 그대로 표시한다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        render(<ThemeToggle />);
        openMenu();

        expect(screen.getByRole('radio', { name: /라이트/ })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(
            screen.getByRole('radio', { name: /설정 따라가기/ })
        ).toHaveAttribute('aria-checked', 'false');
    });

    it('명시적 선택은 저장하고, 설정 따라가기는 키를 지운다', () => {
        render(<ThemeToggle />);

        openMenu();
        fireEvent.click(screen.getByRole('radio', { name: /다크/ }));
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

        openMenu();
        fireEvent.click(screen.getByRole('radio', { name: /설정 따라가기/ }));
        // `system`은 값으로 저장하지 않는다 — 키의 부재가 곧 그 선택이다.
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('설정 따라가기를 고르면 시스템 선호도가 화면에 적용된다', () => {
        stubPrefersColorScheme(true); // OS = light
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        render(<ThemeToggle />);

        openMenu();
        fireEvent.click(screen.getByRole('radio', { name: /설정 따라가기/ }));

        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe(
            'light'
        );
    });

    it('선택 후 메뉴가 닫힌다', () => {
        render(<ThemeToggle />);
        openMenu();
        expect(screen.getByRole('radiogroup')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: /라이트/ }));
        expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    /**
     * WAI-ARIA APG의 라디오 그룹은 **단일 탭 스톱**이다. 세 버튼이 각각 탭
     * 스톱이면 그룹을 지나치려는 사용자가 Tab을 세 번 눌러야 하고, 화살표로
     * 옮기는 관례도 깨진다. 형제 메뉴들이 이미 지키는 규약이다.
     */
    it('선택된 항목만 탭 스톱이다', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        render(<ThemeToggle />);
        openMenu();

        expect(
            screen.getAllByRole('radio').map(r => r.getAttribute('tabindex'))
        ).toEqual(['-1', '-1', '0']);
    });

    it('화살표로 포커스와 선택이 함께 옮겨간다', () => {
        render(<ThemeToggle />); // 저장값 없음 → system(0번)이 선택
        openMenu();

        const radios = screen.getAllByRole('radio');
        fireEvent.keyDown(radios[0]!, { key: 'ArrowDown' });
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

        // 끝에서 한 번 더 내리면 처음으로 돈다.
        fireEvent.keyDown(screen.getAllByRole('radio')[2]!, {
            key: 'ArrowDown',
        });
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('Escape로 닫힌다', () => {
        // 바깥 클릭만 있으면 키보드 사용자에게는 닫을 방법이 없다.
        render(<ThemeToggle />);
        openMenu();
        expect(screen.getByRole('radiogroup')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    it('트리거 라벨이 현재 선택을 말한다', () => {
        // 2단 토글 시절에는 동작("라이트 모드로 전환")을 적었는데, 결과가 셋이
        // 되면서 그 문구는 무엇을 하는 버튼인지 말하지 못하게 됐다.
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        render(<ThemeToggle />);

        expect(
            screen.getByRole('button', { name: '테마: 라이트' })
        ).toBeInTheDocument();
    });
});
