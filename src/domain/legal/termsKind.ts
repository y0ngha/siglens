/** Re-export of TERMS_KIND_VALUES + type for use across layers.
 *  Domain layer imports from infrastructure/db/constants are allowed for
 *  enum value sharing (constants module is pure data). */
export {
    TERMS_KIND_VALUES,
    type TermsKind,
} from '@/infrastructure/db/constants';
