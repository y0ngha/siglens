import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { agreements } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

export interface AgreementInsertInput {
    userId: string;
    termsId: string;
    agreed: boolean;
    agreedAt: Date;
}

export interface AgreementRepository {
    /** Insert multiple agreement rows in a single statement. */
    insertMany(inputs: readonly AgreementInsertInput[]): Promise<void>;
}

export class DrizzleAgreementRepository implements AgreementRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async insertMany(inputs: readonly AgreementInsertInput[]): Promise<void> {
        if (inputs.length === 0) {
            throw new Error('agreement input must not be empty');
        }
        // 회원가입 flow에서 동의 기록 실패는 사용자에게 그대로 에러로 노출되므로
        // transient 실패는 retry로 흡수한다. 전체 batch가 단일 INSERT문이라
        // partial-write 우려도 없다.
        await withRetry(
            () =>
                this.db.insert(agreements).values(
                    inputs.map(input => ({
                        userId: input.userId,
                        termsId: input.termsId,
                        agreed: input.agreed,
                        agreedAt: input.agreedAt,
                    }))
                ),
            NEON_TRANSIENT_RETRY
        );
    }
}
