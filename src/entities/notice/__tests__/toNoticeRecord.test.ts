import { describe, expect, it } from 'vitest';
import { toNoticeRecord } from '@/entities/notice/lib/toNoticeRecord';
import type { NoticeWireRecord } from '@/entities/notice/model/types';

const WIRE: NoticeWireRecord = {
    id: 'n1',
    title: '점검',
    body: '본문',
    linkUrl: 'https://siglens.io/x',
    linkLabel: '자세히',
    pathPattern: '/market',
    createdAt: '2026-06-03T00:00:00.000Z',
};

describe('toNoticeRecord', () => {
    it('createdAt을 ISO 문자열에서 Date로 되돌린다', () => {
        const record = toNoticeRecord(WIRE);
        expect(record.createdAt).toBeInstanceOf(Date);
        expect(record.createdAt.toISOString()).toBe(WIRE.createdAt);
    });

    it('나머지 필드는 그대로 둔다 (null 포함)', () => {
        const wire = {
            ...WIRE,
            linkUrl: null,
            linkLabel: null,
            pathPattern: null,
        };
        expect(toNoticeRecord(wire)).toEqual({
            ...wire,
            createdAt: new Date(WIRE.createdAt),
        });
    });

    it('입력 객체를 변형하지 않는다', () => {
        const wire = { ...WIRE };
        toNoticeRecord(wire);
        expect(wire.createdAt).toBe(WIRE.createdAt);
    });
});
