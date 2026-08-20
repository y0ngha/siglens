import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileSheetPlaceholder } from '@/views/symbol/MobileSheetPlaceholder';
import {
    MOBILE_SHEET_PEEK_BAND_SVH,
    SNAP_PEEK,
} from '@/views/symbol/constants/mobileSheet';

/**
 * 이 껍데기의 존재 이유는 "실제 vaul 시트가 뜨기 전 하단 공백을 메운다"이고,
 * 그 계약은 네 가지다 — (1) 서버에서 렌더될 것, (2) 실제 PEEK 띠와 같은 높이일 것,
 * (3) 모바일에서만 보일 것, (4) CSS 해제 훅(`data-*`)을 가질 것.
 * 아래 테스트는 그 네 가지만 고정한다.
 */
describe('MobileSheetPlaceholder', () => {
    function renderPlaceholder(): HTMLElement {
        const { container } = render(<MobileSheetPlaceholder />);
        const el = container.querySelector<HTMLElement>(
            '[data-mobile-sheet-placeholder]'
        );
        expect(el).not.toBeNull();
        return el as HTMLElement;
    }

    it('globals.css가 숨김 대상으로 삼는 data 속성을 노출한다', () => {
        // 이 속성명이 바뀌면 globals.css의
        // `body:has([data-vaul-drawer]) [data-mobile-sheet-placeholder]` 규칙이
        // 조용히 무력화되고, 실제 시트가 떠도 껍데기가 남는다.
        expect(renderPlaceholder()).toBeTruthy();
    });

    it('실제 PEEK 띠와 같은 높이를 갖는다', () => {
        // 높이가 어긋나면 껍데기→실제 시트 교체 시 띠 높이가 튄다.
        // 값은 MISTAKES.md #19에 따라 커스텀 프로퍼티로 전달되고, 클래스가 그것을 읽는다.
        const el = renderPlaceholder();
        expect(el.style.getPropertyValue('--peek-band')).toBe(
            `${MOBILE_SHEET_PEEK_BAND_SVH}svh`
        );
        expect(el.className).toContain('h-(--peek-band)');
    });

    it('PEEK 띠 상수는 snap − 0.03 산식을 따른다', () => {
        // 산식이 vaul 동작(SNAP_PEEK 주석)과 어긋나면 높이 계약이 깨진다.
        expect(MOBILE_SHEET_PEEK_BAND_SVH).toBeCloseTo(
            (SNAP_PEEK - 0.03) * 100
        );
    });

    it('데스크톱에서는 숨는다', () => {
        // 실제 시트가 md:hidden이므로 껍데기도 같은 브레이크포인트를 써야
        // 데스크톱에 유령 띠가 남지 않는다.
        expect(renderPlaceholder().className).toContain('md:hidden');
    });

    it('장식 전용이라 접근성 트리에서 제외된다', () => {
        // 하이드레이션 전에는 탭해도 열리지 않는다 — 동작하지 않는 컨트롤을
        // 스크린리더에 노출하지 않기 위해 aria-hidden이어야 한다.
        expect(renderPlaceholder().getAttribute('aria-hidden')).toBe('true');
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
