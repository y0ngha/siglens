const mocks = vi.hoisted(() => ({ resolveLocationSurface: vi.fn() }));

vi.mock('@/shared/i18n/locationSurface', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/i18n/locationSurface')>()),
    resolveLocationSurface: mocks.resolveLocationSurface,
}));

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    NotFoundView,
    type NotFoundOverrides,
} from '@/app/_components/NotFoundView';

const OVERRIDES: NotFoundOverrides = {
    site: {
        en: {
            documentTitle: 'Page not found | SIGLENS',
            headline: 'Page not found',
            body: 'This page does not exist.',
            homeLabel: 'Back to SIGLENS',
        },
    },
    ai: {},
    siteWordmark: 'SIGLENS',
    aiWordmark: 'SIGLENS AI',
};

function renderView() {
    return render(
        <NotFoundView overrides={OVERRIDES}>
            <p>server markup</p>
        </NotFoundView>
    );
}

describe('NotFoundView 주소 스냅샷', () => {
    it('주소가 지원 로케일이면 그 표면의 최소 문구로 바꾼다', () => {
        mocks.resolveLocationSurface.mockReturnValue({
            locale: 'en',
            onAiHost: false,
        });

        renderView();

        expect(
            screen.getByRole('heading', { name: 'Page not found' })
        ).toBeInTheDocument();
        expect(screen.queryByText('server markup')).not.toBeInTheDocument();
    });

    it('스냅샷의 로케일이 지원 목록 밖이면 기본 로케일로 보고 서버 마크업을 그대로 둔다', () => {
        mocks.resolveLocationSurface.mockReturnValue({
            locale: 'xx',
            onAiHost: false,
        });

        renderView();

        expect(screen.getByText('server markup')).toBeInTheDocument();
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });
});
