// DrizzleContactRepository は barrel から除外 —
// api.ts が drizzle/schema を import するため client bundle に入ると build が壊れる。
// server consumer は @/entities/inquiry/api から直接 deep import する。
export type { ContactInput, ContactRepository } from './api';

export {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_EMAIL_PATTERN,
    CONTACT_TITLE_MAX_LENGTH,
} from './lib/constants';

export {
    validateContactInput,
    type ValidationResult,
    type ValidationSuccess,
    type ValidationFailure,
} from './lib/validation';
