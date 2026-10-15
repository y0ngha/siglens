import { toSampleSrcDoc } from '@/features/email-report-sample/lib/toSampleSrcDoc';

describe('toSampleSrcDoc', () => {
    it('head 첫머리에 새 탭 열기 base를 넣는다', () => {
        const html =
            '<!doctype html><html><head><meta charset="utf-8" /></head><body><a href="/x">x</a></body></html>';

        expect(toSampleSrcDoc(html)).toBe(
            '<!doctype html><html><head><base target="_blank"><meta charset="utf-8" /></head><body><a href="/x">x</a></body></html>'
        );
    });

    it('head가 없으면 본문을 그대로 둔다', () => {
        expect(toSampleSrcDoc('<p>x</p>')).toBe('<p>x</p>');
    });
});
