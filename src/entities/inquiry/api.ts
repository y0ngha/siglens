import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { inquiries } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/** 문의 레코드 생성 입력. `submitContactAction`이 검증·trim한 값을 넘긴다. */
export interface ContactInput {
    /** 문의 제목. */
    title: string;
    /** 문의 본문. */
    content: string;
    /** 답변을 받을 방문자 이메일. */
    email: string;
}

/** 방문자 문의 저장소 포트. `submitInquiry`가 DB 구현 대신 이 인터페이스에 의존한다. */
export interface ContactRepository {
    /** 문의를 추가한다. `answered`는 DB 기본값 `false`로 들어간다. */
    create(input: ContactInput): Promise<void>;
}

/** Drizzle 기반 {@link ContactRepository} 구현. `submitContactAction`이 요청마다 생성한다. */
export class DrizzleContactRepository implements ContactRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** `inquiries` 테이블에 INSERT한다. transient DB 오류는 재시도하고, 소진되면 throw한다. */
    async create(input: ContactInput): Promise<void> {
        // 문의 제출은 사용자가 명시적으로 클릭한 직후라 실패가 즉시 화면에
        // 노출된다. transient 실패는 retry로 흡수한다.
        await withRetry(
            () =>
                this.db.insert(inquiries).values({
                    title: input.title,
                    content: input.content,
                    email: input.email,
                }),
            DB_TRANSIENT_RETRY
        );
    }
}
