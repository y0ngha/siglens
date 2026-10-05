import type { NoticeRecord, NoticeWireRecord } from '../model/types';

/** `GET /api/notices` 전송 형태를 표시용 레코드로 되돌린다(`createdAt`: ISO 문자열 → `Date`). */
export function toNoticeRecord(wire: NoticeWireRecord): NoticeRecord {
    return { ...wire, createdAt: new Date(wire.createdAt) };
}
