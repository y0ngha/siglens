import { deriveLabelKey } from '@/entities/chat-message/lib/derivePageContextLabel';
import koMessages from '@/../messages/ko.json';

/**
 * 반환값은 표시 문자열이 아니라 `entities.chat-message.pageContext` 키다 —
 * 예전엔 한국어 리터럴이라 `/en/AAPL`의 챗 배지가 `차트 분석`으로 나왔다.
 * 기대값은 ko 카탈로그에서 꺼내 쓴다(문구를 테스트에 복제하면 카탈로그와
 * 갈라져도 통과한다).
 */
const ctx = koMessages.entities['chat-message']
    .pageContext as unknown as Record<string, string>;

describe('deriveLabelKey', () => {
    describe('symbol base page', () => {
        it('/AAPL → 차트 분석', () => {
            expect(deriveLabelKey('/AAPL')).toBe('chart');
        });

        it('/BRK.A → 차트 분석 (dot in symbol)', () => {
            expect(deriveLabelKey('/BRK.A')).toBe('chart');
        });

        it('lowercase /aapl → 차트 분석 (case-insensitive)', () => {
            expect(deriveLabelKey('/aapl')).toBe('chart');
        });
    });

    describe('sub-pages', () => {
        it('/AAPL/fundamental → 펀더멘털 분석', () => {
            expect(deriveLabelKey('/AAPL/fundamental')).toBe('fundamental');
        });

        it('/AAPL/news → 뉴스 분석', () => {
            expect(deriveLabelKey('/AAPL/news')).toBe('news');
        });

        it('/AAPL/overall → AI 종합 분석', () => {
            expect(deriveLabelKey('/AAPL/overall')).toBe('overall');
        });

        it('/AAPL/fear-greed → 공포 탐욕 지수', () => {
            expect(deriveLabelKey('/AAPL/fear-greed')).toBe('fear-greed');
        });

        it('case-insensitive sub-page /AAPL/FUNDAMENTAL → 펀더멘털 분석', () => {
            expect(deriveLabelKey('/AAPL/FUNDAMENTAL')).toBe('fundamental');
        });
    });

    describe('non-symbol pages', () => {
        it('/account → null', () => {
            expect(deriveLabelKey('/account')).toBeNull();
        });

        it('/dashboard → null', () => {
            expect(deriveLabelKey('/dashboard')).toBeNull();
        });

        it('/ (root) → null', () => {
            expect(deriveLabelKey('/')).toBeNull();
        });

        it('/AAPL/unknown-subpage → null (unrecognized sub-page)', () => {
            expect(deriveLabelKey('/AAPL/unknown-subpage')).toBeNull();
        });

        it('/AVERYLONGSYMBOL (>8 chars) → null', () => {
            expect(deriveLabelKey('/AVERYLONGSYMBOL')).toBeNull();
        });
    });

    it.each(['chart', 'fundamental', 'news', 'overall', 'fear-greed'])(
        '%s 키가 ko 카탈로그에 있다',
        key => {
            expect(ctx[key]).toBeTruthy();
        }
    );
});
