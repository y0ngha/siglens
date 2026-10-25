import { LIVE_ANCHOR_HEADING } from '@/shared/config/guideLive';
import { splitMarkdownAtHeading } from '@/views/guide/lib/splitMarkdown';

const DOC = [
    '## 이렇게 봐요',
    '',
    '1. 첫째',
    '',
    '## 시그렌즈에서 확인하는 법',
    '',
    '차트 탭에서 봐요.',
    '',
    '## 자주 틀리는 경우',
    '',
    '추세장.',
].join('\n');

describe('splitMarkdownAtHeading', () => {
    it('앵커 절 끝(다음 h2 직전)에서 나눈다', () => {
        const { before, after } = splitMarkdownAtHeading(
            DOC,
            LIVE_ANCHOR_HEADING
        );
        expect(before.endsWith('차트 탭에서 봐요.')).toBe(true);
        expect(after).toBe('## 자주 틀리는 경우\n\n추세장.');
    });

    it('앵커가 마지막 절이면 after는 null', () => {
        const doc =
            '## 이렇게 봐요\n\n본문\n\n## 시그렌즈에서 확인하는 법\n\n끝.';
        expect(splitMarkdownAtHeading(doc, LIVE_ANCHOR_HEADING)).toEqual({
            before: doc,
            after: null,
        });
    });

    it('앵커가 없으면 통째로 before', () => {
        expect(
            splitMarkdownAtHeading('## 다른 절\n\n본문', LIVE_ANCHOR_HEADING)
        ).toEqual({
            before: '## 다른 절\n\n본문',
            after: null,
        });
    });

    it('여분 공백·닫는 #이 있는 제목도 앵커로 인식한다', () => {
        const doc =
            '## 앞\n\n본문\n\n##   시그렌즈에서 확인하는 법  ##\n\n안내.\n\n##  뒤 #\n\n끝.';
        const { before, after } = splitMarkdownAtHeading(
            doc,
            LIVE_ANCHOR_HEADING
        );
        expect(before.endsWith('안내.')).toBe(true);
        expect(after).toBe('##  뒤 #\n\n끝.');
    });

    it('제목이 다른 h2(접미 숫자)와 h3은 앵커로 보지 않는다', () => {
        const doc = [
            '## 시그렌즈에서 확인하는 법 2',
            '',
            '### 시그렌즈에서 확인하는 법',
            '',
            '## 다음',
            '',
            '끝.',
        ].join('\n');
        expect(splitMarkdownAtHeading(doc, LIVE_ANCHOR_HEADING)).toEqual({
            before: doc,
            after: null,
        });
    });

    it('앵커 절 안의 h3은 절 끝을 만들지 않는다', () => {
        const doc =
            '## 시그렌즈에서 확인하는 법\n\n### 소제목\n\n안내.\n\n## 다음\n\n끝.';
        expect(splitMarkdownAtHeading(doc, LIVE_ANCHOR_HEADING).after).toBe(
            '## 다음\n\n끝.'
        );
    });

    it('코드 펜스 안의 ## 줄은 다음 절 경계로 보지 않는다', () => {
        const doc = [
            '## 시그렌즈에서 확인하는 법',
            '',
            '```md',
            '## 예시 제목',
            '```',
            '',
            '~~~',
            '## 또 다른 예시',
            '~~~',
            '',
            '## 자주 틀리는 경우',
            '',
            '끝.',
        ].join('\n');
        const { before, after } = splitMarkdownAtHeading(
            doc,
            LIVE_ANCHOR_HEADING
        );
        expect(before).toContain('## 또 다른 예시');
        expect(after).toBe('## 자주 틀리는 경우\n\n끝.');
    });

    it('코드 펜스 안의 앵커 제목은 앵커로 보지 않는다', () => {
        const doc = [
            '## 첫 절',
            '',
            '```',
            '## 시그렌즈에서 확인하는 법',
            '```',
            '',
            '## 다음 절',
        ].join('\n');
        expect(splitMarkdownAtHeading(doc, LIVE_ANCHOR_HEADING)).toEqual({
            before: doc,
            after: null,
        });
    });
});
