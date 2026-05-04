import { agreements } from '@/infrastructure/db/schema';
import type { SiglensDatabase } from '@/infrastructure/db/types';

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
        await this.db.insert(agreements).values(
            inputs.map(input => ({
                userId: input.userId,
                termsId: input.termsId,
                agreed: input.agreed,
                agreedAt: input.agreedAt,
            }))
        );
    }
}
