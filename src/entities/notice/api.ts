import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { notices } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { localizeContent } from '@/shared/db/localizeContent';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
} from '@/shared/db/contentTranslationFields';
import type { Locale } from '@/shared/i18n/locales';
import type { NoticeRecord } from './model/types';

/** 활성 공지 조회 repository. */
export interface NoticeRepository {
    /**
     * 노출 조건(활성 + 시간창)을 만족하는 공지를 priority/최신순으로 반환.
     *
     * 문구는 요청 로케일로 해석해서 돌려준다 — 원본 행의 한국어 컬럼을 그대로
     * 내보내면 `/en`의 공지 팝업이 한국어를 렌더한다.
     */
    findActive(locale: Locale): Promise<NoticeRecord[]>;
}

/** Drizzle ORM-backed 구현. */
export class DrizzleNoticeRepository implements NoticeRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async findActive(locale: Locale): Promise<NoticeRecord[]> {
        // findActive는 non-critical 경로(공지)라 withRetry를 쓰지 않는다.
        // 호출부(getActiveNoticesAction)가 실패를 빈 배열로 흡수한다.
        const rows = await this.db
            .select({
                id: notices.id,
                title: notices.title,
                body: notices.body,
                linkUrl: notices.linkUrl,
                linkLabel: notices.linkLabel,
                pathPattern: notices.pathPattern,
                createdAt: notices.createdAt,
            })
            .from(notices)
            .where(
                and(
                    eq(notices.isActive, true),
                    or(
                        isNull(notices.startsAt),
                        lte(notices.startsAt, sql`NOW()`)
                    ),
                    or(isNull(notices.endsAt), gte(notices.endsAt, sql`NOW()`))
                )
            )
            .orderBy(desc(notices.priority), desc(notices.createdAt));

        const localized = await localizeContent({
            entity: TRANSLATABLE_ENTITY.notice,
            rows,
            locale,
            id: row => row.id,
            fields: {
                title: {
                    field: CONTENT_FIELD.notice.title,
                    legacy: row => ({ ko: row.title }),
                },
                body: {
                    field: CONTENT_FIELD.notice.body,
                    legacy: row => ({ ko: row.body }),
                },
                linkLabel: {
                    field: CONTENT_FIELD.notice.linkLabel,
                    legacy: row => ({ ko: row.linkLabel }),
                },
            },
        });

        return localized.map(row => ({
            id: row.id,
            // 제목·본문은 원본이 `notNull`이라 해석 실패가 나올 수 없지만,
            // 사이드카가 빈 문자열을 들고 있으면 `pickContentLocale`이 건너뛰어
            // null이 될 수 있다 — 그때는 원본으로 되돌린다.
            title: row.localized.title?.value ?? row.title,
            body: row.localized.body?.value ?? row.body,
            linkUrl: row.linkUrl,
            linkLabel: row.localized.linkLabel?.value ?? row.linkLabel,
            pathPattern: row.pathPattern,
            createdAt: row.createdAt,
            // 폴백 여부는 담지 않는다. 공지는 배너를 띄우지 않아(짧은 안내문이라
            // 폴백이 곧 원문) 읽는 쪽이 없었고, 그러면서 공지마다 flight
            // 페이로드만 차지했다. 약관은 다르다 — 거기는 배너가 실제로 뜬다.
        }));
    }
}
