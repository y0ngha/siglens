import { SIGNAL_HUBS } from '@/entities/signal-history/lib/signalHubs';
import { hubsForGuide } from '../hubsForGuide';

describe('hubsForGuide', () => {
    it('이동평균선 가이드는 골든크로스·데드크로스 신호 페이지를 돌려준다', () => {
        expect(
            hubsForGuide({ category: 'indicators', slug: 'ma' }).map(
                hub => hub.slug
            )
        ).toEqual(['golden-cross', 'death-cross']);
    });

    it('신호 페이지가 가리키지 않는 항목은 빈 배열이다', () => {
        expect(
            hubsForGuide({ category: 'candlesticks', slug: 'doji' })
        ).toEqual([]);
    });

    it('카테고리가 다르면 같은 슬러그라도 잡지 않는다', () => {
        expect(hubsForGuide({ category: 'howto', slug: 'ma' })).toEqual([]);
    });

    it('모든 신호 페이지는 자기 가이드 항목에서 찾아진다', () => {
        for (const hub of SIGNAL_HUBS) {
            expect(hubsForGuide(hub.guide)).toContain(hub);
        }
    });
});
