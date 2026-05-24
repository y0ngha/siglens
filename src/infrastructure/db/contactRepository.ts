import { NEON_TRANSIENT_RETRY } from '@/infrastructure/db/isNeonTransientError';
import { inquiries } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/** Input required to create a new inquiry record. */
export interface ContactInput {
    /** Short subject line for the inquiry. */
    title: string;
    /** Full body text of the inquiry. */
    content: string;
    /** Reply-to email address provided by the visitor. */
    email: string;
}

/** Repository for persisting visitor inquiries. */
export interface ContactRepository {
    /** Insert a new inquiry record; the `answered` flag defaults to `false` at the database level. */
    create(input: ContactInput): Promise<void>;
}

/** Drizzle ORM-backed implementation of {@link ContactRepository}. */
export class DrizzleContactRepository implements ContactRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /** Insert the inquiry record into the database. */
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
            NEON_TRANSIENT_RETRY
        );
    }
}
