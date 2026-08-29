import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    usePathname: () => '/NVDA',
}));

import { HeaderSearch } from '@/features/ticker-search/ui/HeaderSearch';
import { SearchOverlayProvider } from '@/features/ticker-search/model/SearchOverlayContext';
import { SEARCH_TRIGGER_LABEL_KEY } from '@/features/ticker-search/lib/searchLabels';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

// 문구를 테스트에 복제하지 않는다 — 카탈로그를 읽으면 키 오타나 문구 변경이
// 곧바로 여기서 드러난다(MISTAKES #13.5).
const SEARCH_TRIGGER_LABEL = catalogTranslator(
    'features.ticker-search',
    'ko'
)(SEARCH_TRIGGER_LABEL_KEY);

/**
 * `ml-auto`는 레이아웃 **계약**이다. 헤더에서 유저메뉴·햄버거를 오른쪽 끝으로 미는
 * 장치가 원래 검색 래퍼의 `ml-auto` 하나뿐이었다. 두 표면 중 그 시점에 보이는 쪽이
 * 반드시 이어받아야 CTA가 로고 쪽으로 붕괴하지 않는다 — 눈으로만 확인하고 넘어가면
 * 나중에 조용히 깨진다.
 */
describe('HeaderSearch', () => {
    function renderWithProvider(withOverlayProvider = true) {
        // 데스크톱 자동완성이 React Query를 쓰므로 함께 감싼다.
        const qc = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const tree = withOverlayProvider ? (
            <SearchOverlayProvider>
                <HeaderSearch />
            </SearchOverlayProvider>
        ) : (
            <HeaderSearch />
        );
        return render(
            <QueryClientProvider client={qc}>{tree}</QueryClientProvider>
        );
    }

    it('모바일 트리거가 ml-auto를 갖는다', () => {
        renderWithProvider();
        const trigger = screen.getByRole('button', {
            name: SEARCH_TRIGGER_LABEL,
        });
        expect(trigger.className).toContain('ml-auto');
        expect(trigger.className).toContain('lg:hidden');
    });

    it('데스크톱 자동완성 래퍼도 ml-auto를 갖고 lg에서만 보인다', () => {
        renderWithProvider();
        // 위치가 아니라 **내용**으로 찾는다 — `container.querySelector('div.hidden')`은
        // 트리에서 첫 번째로 `hidden`을 가진 div를 집으므로, 관계없는 요소가 앞에
        // 추가되면 조용히 다른 것을 검사하게 된다.
        const wrapper = screen
            .getByRole('combobox', { name: '종목 티커 검색' })
            .closest('div.hidden');
        expect(wrapper?.className).toContain('ml-auto');
        expect(wrapper?.className).toContain('lg:flex');
    });

    it('Provider가 없으면 트리거를 렌더하지 않는다', () => {
        // 눌러도 아무 일 없는 버튼을 남기느니 감춘다. 헤더 자체는 정상 렌더돼야 한다.
        expect(() => renderWithProvider(false)).not.toThrow();
        expect(
            screen.queryByRole('button', { name: SEARCH_TRIGGER_LABEL })
        ).toBeNull();
    });
});
