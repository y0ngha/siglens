import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { agreements } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';

/** 약관 동의 한 건. `agreedAt`은 동의 시각(서버 시각)으로 호출부가 채운다. */
export interface AgreementInsertInput {
    userId: string;
    termsId: string;
    agreed: boolean;
    agreedAt: Date;
}

/**
 * 약관 동의 기록 저장소 포트. auth 유스케이스(`authUseCaseTypes`)가 이 인터페이스에만
 * 의존하고 구현은 서버 액션이 주입한다.
 */
export interface AgreementRepository {
    /** 여러 동의 행을 단일 INSERT문으로 저장한다. 빈 배열은 호출부 버그이므로 throw. */
    insertMany(inputs: readonly AgreementInsertInput[]): Promise<void>;
}

/**
 * `agreements` 테이블 Drizzle 구현. 회원가입·OAuth 동의 서버 액션에서 사용하며,
 * `(user_id, terms_id)` unique 인덱스 때문에 같은 약관을 중복 저장하면 DB 오류가 난다.
 */
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
            DB_TRANSIENT_RETRY
        );
    }
}
