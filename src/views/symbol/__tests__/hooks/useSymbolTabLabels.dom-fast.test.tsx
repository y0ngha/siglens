import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { TABS } from '@/views/symbol/utils/symbolTabsConfig';
import { useSymbolTabLabels } from '@/views/symbol/hooks/useSymbolTabLabels';

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
} as const;

describe('useSymbolTabLabels', () => {
    it.each(Object.keys(CATALOGS) as (keyof typeof CATALOGS)[])(
        '%s: 모든 탭 키를 그 로케일 카탈로그의 라벨로 푼다',
        locale => {
            const { result } = renderHook(() => useSymbolTabLabels(), {
                wrapper: ({ children }: { children: ReactNode }) =>
                    withLocale(children, locale),
            });
            const catalog: Record<string, string> =
                CATALOGS[locale].shared.symbolTab;
            for (const tab of TABS) {
                expect(result.current[tab.key]).toBe(catalog[tab.key]);
            }
        }
    );
});
