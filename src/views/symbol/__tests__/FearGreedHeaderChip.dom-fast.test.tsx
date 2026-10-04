import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import type { FearGreedLabel, FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedHeaderChip } from '@/views/symbol/FearGreedHeaderChip';
import {
    CONFIDENCE_LIMITED_KEY,
    sentimentLabelText,
} from '@/shared/lib/fearGreedLabels';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

// confidence 라벨은 `shared.lib.fearGreed` 카탈로그에서 온다.
const tFearGreed = catalogTranslator('shared.lib.fearGreed', 'ko');

const FEAR_GREED_LABELS: readonly FearGreedLabel[] = [
    'EXTREME_FEAR',
    'FEAR',
    'NEUTRAL',
    'GREED',
    'EXTREME_GREED',
];

let t: EnumLabelTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' });
});

const make = (
    label: FearGreedSnapshot['label'],
    confidence: FearGreedSnapshot['confidence'] = 'normal'
): FearGreedSnapshot => ({
    score: 50,
    label,
    groups: [],
    confidence,
    sampleSize: 200,
    warning: null,
});

describe('FearGreedHeaderChip', () => {
    describe('placeholder states', () => {
        // siglens-core 0.8.0 narrowed `FearGreedSnapshot.confidence` to
        // `Exclude<FearGreedConfidence, 'insufficient'>` — `'insufficient'`
        // is now unrepresentable in the type and surfaces as `null` from
        // computeFearGreedIndex. We therefore only test the `null` path.
        it('renders "데이터 부족" when snapshot is null', () => {
            const { getByText } = render(
                <FearGreedHeaderChip snapshot={null} />
            );
            expect(getByText(/데이터 부족/)).toBeInTheDocument();
        });
    });

    describe('label rendering', () => {
        it.each(FEAR_GREED_LABELS)(
            'renders %s with its localized text',
            label => {
                const { getByText } = render(
                    <FearGreedHeaderChip snapshot={make(label)} />
                );
                expect(
                    getByText(sentimentLabelText(label, t))
                ).toBeInTheDocument();
            }
        );
    });

    describe('confidence indicator', () => {
        it('shows ⓘ when confidence is limited', () => {
            const { container } = render(
                <FearGreedHeaderChip snapshot={make('NEUTRAL', 'limited')} />
            );
            expect(container.textContent).toContain('ⓘ');
        });

        it('does not show ⓘ when confidence is normal', () => {
            const { container } = render(
                <FearGreedHeaderChip snapshot={make('NEUTRAL', 'normal')} />
            );
            expect(container.textContent).not.toContain('ⓘ');
        });
    });

    describe('score rendering', () => {
        it('rounds and renders the score', () => {
            const { getByText } = render(
                <FearGreedHeaderChip
                    snapshot={{ ...make('GREED'), score: 67.4 }}
                />
            );
            expect(getByText('67')).toBeInTheDocument();
        });
    });

    describe('aria-label', () => {
        it('exposes label, score, and confidence note via aria-label', () => {
            const { container } = render(
                <FearGreedHeaderChip
                    snapshot={{ ...make('GREED', 'limited'), score: 60.6 }}
                />
            );
            const chip = container.querySelector('[aria-label]');
            expect(chip?.getAttribute('aria-label')).toBe(
                `공포 탐욕 지수 ${sentimentLabelText('GREED', t)} 61점 (${tFearGreed(CONFIDENCE_LIMITED_KEY)})`
            );
        });
    });

    describe('로케일 회귀', () => {
        // `SENTIMENT_LABEL_TEXT`가 하드코딩 한글 Record였을 때는 en 로케일
        // 에서도 이 칩만 한글로 남아 "AAPL Technical Direction: 보합" 류의
        // 반쪽짜리 영어 문장이 나왔다(원 이슈 재현 대상). `renderWithIntl`로
        // 실제 en 카탈로그를 태워야 이 결함이 잡힌다 — 전역 `render()`는
        // 항상 ko provider라 이 클래스의 결함을 검출하지 못한다.
        it('locale=en이면 라벨을 영어로 렌더하고 한글이 남지 않는다', () => {
            const { container } = renderWithIntl(
                <FearGreedHeaderChip
                    snapshot={{ ...make('GREED'), score: 61 }}
                />,
                { locale: 'en' }
            );

            expect(container.textContent).toContain('Greed');
            expect(container.textContent ?? '').not.toMatch(/[가-힣]/);
        });
    });
});
