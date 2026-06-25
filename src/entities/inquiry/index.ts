// DrizzleContactRepository는 barrel에서 제외 — api.ts가 drizzle/schema를 import하므로
// client bundle에 포함되면 build가 깨진다. server 소비자는 @/entities/inquiry/api에서 직접 import한다.
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
