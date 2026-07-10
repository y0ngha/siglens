export const LOCAL_STORAGE_PROVIDER_KEY = 'siglens:selected-provider';
export const LOCAL_STORAGE_ANALYSIS_MODEL_KEY =
    'siglens:selected-analysis-model';

/**
 * One-time flag marking that the legacy analysis-model migration has run in this
 * browser. Once set, users who stored the old default (`gemini-2.5-flash-lite`)
 * were moved to the new DeepSeek default; any later switch back to flash-lite is
 * a deliberate post-flip choice and must never be migrated again.
 */
export const LOCAL_STORAGE_ANALYSIS_MODEL_MIGRATION_KEY =
    'siglens_analysis_model_deepseek_migrated';
