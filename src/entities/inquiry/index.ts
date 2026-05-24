export {
    DrizzleContactRepository,
    type ContactInput,
    type ContactRepository,
} from './api';

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
