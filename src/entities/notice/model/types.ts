/** 클라이언트로 전달되는 공지 표시용 레코드. is_active/starts_at/ends_at은
 *  서버 필터에만 쓰이므로 포함하지 않는다. priority는 서버에서 정렬을 끝내므로
 *  클라이언트는 배열 순서만 유지하면 된다. */
export interface NoticeRecord {
    id: string;
    title: string;
    body: string;
    linkUrl: string | null;
    linkLabel: string | null;
    pathPattern: string | null;
    createdAt: Date;
}
