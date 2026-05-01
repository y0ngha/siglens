import { inquiries } from './schema';
import type { SiglensDatabase } from './types';

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
        await this.db.insert(inquiries).values({
            title: input.title,
            content: input.content,
            email: input.email,
        });
    }
}
