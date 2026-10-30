'use client';

/**
 * 공지 작성일 문구("2026.06.03 작성")를 현재 로케일로 만드는 훅.
 */
import { useTranslations } from 'next-intl';
import { formatNoticeDate } from '@/entities/notice/lib/formatNoticeDate';

/**
 * 작성일 문구를 돌려준다. 날짜를 읽을 수 없으면 빈 문자열이다.
 *
 * 날짜 분해(entity `lib/`)와 문장 조립을 UI 파일 밖, 번역자를 직접 선언한 이 훅에서
 * 한다 — 번역자를 인자로 넘겨 그 안에서 리터럴 키를 부르면 추출기가 키를 클라이언트
 * 페이로드에서 빠뜨린다.
 */
export function useNoticeWrittenOnLabel(createdAt: Date): string {
    const tMisc = useTranslations('shared.ui.misc');
    const parts = formatNoticeDate(createdAt);
    if (parts === null) return '';
    return tMisc('noticeWrittenOn', {
        v0: parts.year,
        v1: parts.month,
        v2: parts.day,
    });
}
