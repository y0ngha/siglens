import { render } from '@testing-library/react';
import {
    SelfNormWarningBadge,
    WARNING_TEXT_KEY,
} from '@/widgets/fear-greed/SelfNormWarningBadge';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

// 문구는 `shared.lib.fearGreed` 카탈로그에서 온다 — 예전엔 모듈 상수라
// 비-ko 로케일에서도 한국어 경고가 그대로 나갔다.
const tFearGreedKo = catalogTranslator('shared.lib.fearGreed', 'ko');

describe('SelfNormWarningBadge', () => {
    describe('rendering by warning value', () => {
        it('renders nothing when warning is null', () => {
            const { container } = render(
                <SelfNormWarningBadge warning={null} />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders the full chronic-weakness sentence verbatim per spec §4.5', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_WEAKNESS" />
            );
            expect(
                getByText(tFearGreedKo(WARNING_TEXT_KEY.CHRONIC_WEAKNESS))
            ).toBeInTheDocument();
        });

        it('renders the full chronic-strength sentence verbatim per spec §4.5', () => {
            const { getByText } = render(
                <SelfNormWarningBadge warning="CHRONIC_STRENGTH" />
            );
            expect(
                getByText(tFearGreedKo(WARNING_TEXT_KEY.CHRONIC_STRENGTH))
            ).toBeInTheDocument();
        });
    });
});
