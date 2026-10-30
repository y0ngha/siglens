import type { NoticeRecord } from '@/entities/notice/model/types';
import { selectNoticeQueue } from '../utils/selectNoticeQueue';

function notice(overrides: Partial<NoticeRecord> = {}): NoticeRecord {
    return {
        id: 'n1',
        title: '점검 안내',
        body: '본문',
        linkUrl: null,
        linkLabel: null,
        pathPattern: null,
        createdAt: new Date(2026, 5, 3),
        ...overrides,
    };
}

const NO_IDS: ReadonlySet<string> = new Set();

describe('selectNoticeQueue', () => {
    it('서버 순서를 유지한 채 전역 공지를 모두 남긴다', () => {
        const queue = selectNoticeQueue(
            [notice({ id: 'b' }), notice({ id: 'a' })],
            { pathname: '/', dismissedIds: NO_IDS, consumedIds: NO_IDS }
        );
        expect(queue.map(n => n.id)).toEqual(['b', 'a']);
    });

    it('경로 패턴이 맞지 않는 공지는 뺀다', () => {
        const queue = selectNoticeQueue(
            [
                notice({ id: 'market', pathPattern: '/market' }),
                notice({ id: 'symbol', pathPattern: '/symbol/*' }),
            ],
            {
                pathname: '/symbol/AAPL',
                dismissedIds: NO_IDS,
                consumedIds: NO_IDS,
            }
        );
        expect(queue.map(n => n.id)).toEqual(['symbol']);
    });

    it('영구 dismiss된 공지는 뺀다', () => {
        const queue = selectNoticeQueue(
            [notice({ id: 'kept' }), notice({ id: 'dismissed' })],
            {
                pathname: '/',
                dismissedIds: new Set(['dismissed']),
                consumedIds: NO_IDS,
            }
        );
        expect(queue.map(n => n.id)).toEqual(['kept']);
    });

    it('이번 세션에 닫은 공지는 뺀다', () => {
        const queue = selectNoticeQueue(
            [notice({ id: 'closed' }), notice({ id: 'next' })],
            {
                pathname: '/',
                dismissedIds: NO_IDS,
                consumedIds: new Set(['closed']),
            }
        );
        expect(queue.map(n => n.id)).toEqual(['next']);
    });
});
