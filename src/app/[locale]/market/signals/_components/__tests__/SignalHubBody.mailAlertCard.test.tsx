vi.mock('next-intl/server', async () => {
    const { catalogTranslator } =
        await import('@/shared/test-utils/catalogTranslator');
    return {
        getLocale: async () => 'ko',
        getTranslations: async (
            arg: string | { locale?: string; namespace?: string }
        ) =>
            typeof arg === 'string'
                ? catalogTranslator(arg, 'ko')
                : catalogTranslator(arg.namespace ?? '', arg.locale ?? 'ko'),
    };
});
vi.mock('../../_lib/loadSignalHub', () => ({
    loadSignalHub: vi.fn(async () => ({
        rows: [],
        counts: { us: 0, kr: 0 },
        degraded: false,
    })),
}));
vi.mock('@/entities/guide/api', () => ({
    loadGuideCatalog: vi.fn(async () => ({
        entries: [
            {
                category: 'indicators',
                slug: 'ma',
                title: '이동평균선',
                summary: '일정 기간 종가의 평균을 이은 선이에요.',
            },
        ],
    })),
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
// 이 파일은 카드 위치만 본다 — 과거 기록 표(자기 제목을 가진다)는 `views/signal-record` 스위트가 검사한다.
vi.mock('@/views/signal-record/SignalBaseRateTable', () => ({
    SignalBaseRateTable: () => null,
}));
const launched = vi.hoisted(() => ({ value: true }));
vi.mock(
    '@/entities/mail-alert/lib/mailAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/mailAlertConstants')
        >()),
        isMailAlertLaunched: () => launched.value,
    })
);

import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { findSignalHub } from '@/entities/signal-history/lib/signalHubs';
import { defined } from '@/shared/test-utils/defined';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { resolveAsyncServerTree } from '@/shared/test-utils/resolveAsyncServerTree';
import ko from '../../../../../../../messages/ko.json';
import { SignalHubBody } from '../SignalHubBody';

const HUB = findSignalHub('golden-cross');
const SIGNAL = ko.shared.enumLabel.signalType.golden_cross;
const CARD_LINE = `새로 잡힌 ${SIGNAL} 종목을 아침에 메일로 받아 보세요`;

async function renderBody() {
    const hub = defined(HUB, 'golden-cross hub');
    const tree = await SignalHubBody({ hub, locale: 'ko' });
    return renderWithIntl((await resolveAsyncServerTree(tree)) as ReactElement);
}

describe('신호별 종목 허브의 "메일로 받기" 카드', () => {
    it('공개 전에는 그리지 않는다', async () => {
        launched.value = false;
        await renderBody();

        expect(screen.queryByText(CARD_LINE)).not.toBeInTheDocument();
    });

    it('공개 후에는 소개 문단 뒤, 가이드 구역 앞에 카드를 둔다', async () => {
        launched.value = true;
        await renderBody();

        const intro = screen.getByText(/골든크로스/, { selector: 'p' });
        const card = screen.getByText(CARD_LINE);
        const guide = screen.getByRole('heading', {
            level: 2,
            name: /이동평균선|골든크로스/,
        });
        expect(
            intro.compareDocumentPosition(card) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
            card.compareDocumentPosition(guide) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });
});
