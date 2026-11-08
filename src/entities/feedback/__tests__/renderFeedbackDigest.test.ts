import { buildFeedbackDigest } from '../lib/buildFeedbackDigest';
import { renderFeedbackDigest } from '../templates/operator-mail/renderFeedbackDigest';
import type { FeedbackDigestRow } from '../lib/types';

function row(partial: Partial<FeedbackDigestRow>): FeedbackDigestRow {
    return {
        surface: 'siglens',
        vote: 'down',
        reasons: ['inaccurate'],
        comment: null,
        targetType: 'technical',
        symbol: 'AAPL',
        createdAt: new Date(),
        ...partial,
    };
}

describe('renderFeedbackDigest', () => {
    const at = new Date('2026-11-08T15:30:00Z');

    it('제목에 KST 날짜와 👍/👎 합계를 싣는다', () => {
        const digest = buildFeedbackDigest([row({}), row({ vote: 'up' })]);
        expect(renderFeedbackDigest(digest, at).subject).toBe(
            '[SIGLENS] AI 응답 피드백 요약 2026-11-09 (👍 1 / 👎 1)'
        );
    });

    it('text 에 그룹 집계와 👎 사유(한국어 라벨)·의견을 싣는다', () => {
        const digest = buildFeedbackDigest([
            row({
                comment: '숫자가\n틀려요',
                reasons: ['inaccurate', 'too_long'],
            }),
        ]);
        const { text } = renderFeedbackDigest(digest, at);
        expect(text).toContain('- siglens / technical: 👍 0 / 👎 1');
        expect(text).toContain(
            'siglens / technical / AAPL [부정확, 너무 김] — 숫자가 틀려요'
        );
    });

    it('사유가 없으면 "사유 없음"이다', () => {
        const digest = buildFeedbackDigest([row({ reasons: null })]);
        expect(renderFeedbackDigest(digest, at).text).toContain('[사유 없음]');
    });

    it('html 에서 사용자 입력을 이스케이프한다', () => {
        const digest = buildFeedbackDigest([
            row({ comment: '<img src=x onerror=alert(1)>', symbol: '<b>' }),
        ]);
        const { html } = renderFeedbackDigest(digest, at);
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('생략된 👎 가 있으면 건수를 안내한다', () => {
        const digest = buildFeedbackDigest(
            Array.from({ length: 51 }, () => row({}))
        );
        const out = renderFeedbackDigest(digest, at);
        expect(out.text).toContain('외 1건');
        expect(out.html).toContain('외 1건');
    });

    it('👎 가 없으면 목록 섹션을 싣지 않는다', () => {
        const digest = buildFeedbackDigest([row({ vote: 'up' })]);
        const out = renderFeedbackDigest(digest, at);
        expect(out.text).not.toContain('👎 목록');
        expect(out.html).not.toContain('👎 목록');
    });
});
