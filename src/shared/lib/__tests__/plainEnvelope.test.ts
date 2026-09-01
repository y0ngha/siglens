import { describe, expect, it } from 'vitest';
import { readPlain } from '../plainEnvelope';

describe('readPlain', () => {
    it('봉투의 plain 문자열을 꺼낸다', () => {
        expect(
            readPlain({ status: 'done', result: {}, plain: '쉬운 글' })
        ).toBe('쉬운 글');
    });

    /** 롤링 배포 중 구버전 인스턴스는 필드 자체를 안 보낸다. */
    it('필드가 없으면 null', () => {
        expect(readPlain({ status: 'done', result: {} })).toBeNull();
    });

    it('null이면 null — 재작성 실패의 정상 신호다', () => {
        expect(readPlain({ plain: null })).toBeNull();
    });

    /**
     * 공백만 있는 값을 통과시키면 `PlainAnalysisSwitch`가 토글을 렌더하고,
     * `PlainAnalysisView`는 문단이 0개라 아무것도 그리지 않는다 — 눌러도 화면이
     * 비는 토글이 된다.
     */
    it('공백뿐이면 null', () => {
        expect(readPlain({ plain: '   \n\n  ' })).toBeNull();
    });

    it('문자열이 아니면 null', () => {
        expect(readPlain({ plain: 42 })).toBeNull();
        expect(readPlain({ plain: { text: 'x' } })).toBeNull();
    });

    it('봉투가 객체가 아니어도 던지지 않는다', () => {
        expect(readPlain(null)).toBeNull();
        expect(readPlain(undefined)).toBeNull();
        expect(readPlain('문자열')).toBeNull();
    });
});
