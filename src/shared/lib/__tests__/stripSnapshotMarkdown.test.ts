import { describe, it, expect } from 'vitest';
import { stripSnapshotMarkdown } from '../stripSnapshotMarkdown';

describe('stripSnapshotMarkdown', () => {
    it('strips **bold** markers and keeps the inner text', () => {
        expect(stripSnapshotMarkdown('이 지표는 **강조** 표시입니다.')).toBe(
            '이 지표는 강조 표시입니다.'
        );
    });

    it('strips __bold__ (underscore) markers', () => {
        expect(stripSnapshotMarkdown('__강조__ 텍스트')).toBe('강조 텍스트');
    });

    it('strips leading "- " list markers per line', () => {
        expect(stripSnapshotMarkdown('- 항목 하나\n- 항목 둘')).toBe(
            '항목 하나\n항목 둘'
        );
    });

    it('strips leading "* " list markers per line without touching mid-line asterisks', () => {
        expect(stripSnapshotMarkdown('* 항목 하나')).toBe('항목 하나');
    });

    it('strips leading numbered-list markers ("1. ") per line', () => {
        expect(stripSnapshotMarkdown('1. 첫 번째\n2. 두 번째')).toBe(
            '첫 번째\n두 번째'
        );
    });

    it('strips leading heading markers ("#", "##", ...) per line', () => {
        expect(stripSnapshotMarkdown('## 소제목\n본문')).toBe('소제목\n본문');
    });

    it('strips inline code backticks', () => {
        expect(stripSnapshotMarkdown('`RSI` 지표가 과매수 구간입니다.')).toBe(
            'RSI 지표가 과매수 구간입니다.'
        );
    });

    it('strips single-asterisk and single-underscore italic markers', () => {
        expect(stripSnapshotMarkdown('*기울임* 텍스트와 _다른 기울임_')).toBe(
            '기울임 텍스트와 다른 기울임'
        );
    });

    it('combines multiple marker types in one input (audit FIX 4 example)', () => {
        const input = '**강조**된 항목입니다.\n- 항목 하나\n- 항목 둘';
        const output = stripSnapshotMarkdown(input);

        expect(output).not.toContain('**');
        expect(output).not.toMatch(/^- /m);
        expect(output).toContain('강조된 항목입니다.');
        expect(output).toContain('항목 하나');
        expect(output).toContain('항목 둘');
    });

    it('leaves plain text without markdown markers unchanged', () => {
        const plain = 'AAPL은 200일선 위에서 상승 추세를 이어가고 있습니다.';
        expect(stripSnapshotMarkdown(plain)).toBe(plain);
    });

    it('does not strip a decimal point inside a number (not a numbered-list marker)', () => {
        expect(stripSnapshotMarkdown('상승률은 3.5% 입니다.')).toBe(
            '상승률은 3.5% 입니다.'
        );
    });

    it('returns an empty string unchanged', () => {
        expect(stripSnapshotMarkdown('')).toBe('');
    });
});
