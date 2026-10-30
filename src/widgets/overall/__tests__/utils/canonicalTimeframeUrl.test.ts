import { canonicalTimeframeUrl } from '@/widgets/overall/utils/canonicalTimeframeUrl';

describe('canonicalTimeframeUrl', () => {
    it('쿼리가 tf뿐이면 tf만 바꾼다', () => {
        expect(
            canonicalTimeframeUrl('/AAPL/overall', '?tf=1Hour', '', '1Day')
        ).toBe('/AAPL/overall?tf=1Day');
    });

    it('다른 쿼리 파라미터를 순서대로 지킨다', () => {
        expect(
            canonicalTimeframeUrl(
                '/AAPL/overall',
                '?utm_source=mail&tf=1Hour&ref=a%20b',
                '',
                '1Day'
            )
        ).toBe('/AAPL/overall?utm_source=mail&tf=1Day&ref=a+b');
    });

    it('해시를 그대로 붙인다', () => {
        expect(
            canonicalTimeframeUrl(
                '/ja/AAPL/overall',
                '?tf=4Hour',
                '#scenario-analysis-heading',
                '1Day'
            )
        ).toBe('/ja/AAPL/overall?tf=1Day#scenario-analysis-heading');
    });

    it('쿼리가 비어 있으면 tf를 새로 붙인다', () => {
        expect(canonicalTimeframeUrl('/AAPL/overall', '', '', '1Day')).toBe(
            '/AAPL/overall?tf=1Day'
        );
    });
});
