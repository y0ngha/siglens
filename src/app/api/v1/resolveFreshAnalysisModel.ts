import 'server-only';
import type { ModelId } from '@y0ngha/siglens-core';
import { DrizzleSiglensApiKeyRepository } from '@/entities/siglens-api-key/api';
import { isKnownApiModel } from '@/entities/siglens-api-key/lib/apiModels';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { getDatabaseClient } from '@/shared/db/client';
import { API_STATUS } from './apiResponse';
import { fail, type Failure } from './freshAnalysisOutcomes';

/**
 * 사용할 모델: 요청의 `model` 인자 → 없으면 `users.api_default_model`. 둘 다 없으면 400 `model_required`,
 * 로스터에 없으면 400 `invalid_model`, 기본 모델 조회가 실패하면 503.
 */
export type ModelResolution =
    | { ok: true; model: ModelId }
    | { ok: false; failure: Failure };

export async function resolveRequestedModel(
    requested: unknown,
    principal: ApiKeyPrincipal
): Promise<ModelResolution> {
    if (typeof requested === 'string') {
        return isKnownApiModel(requested)
            ? { ok: true, model: requested }
            : {
                  ok: false,
                  failure: fail(
                      API_STATUS.badRequest,
                      'invalid_model',
                      'Unknown model. See GET /api/v1/tools for the accepted values.',
                      { model: requested }
                  ),
              };
    }
    let stored: string | null;
    try {
        stored = await new DrizzleSiglensApiKeyRepository(
            getDatabaseClient().db
        ).findApiDefaultModel(principal.userId);
    } catch (error) {
        console.error(
            '[api/v1 run_fresh_analysis] default model lookup failed:',
            error
        );
        return {
            ok: false,
            failure: fail(
                API_STATUS.serviceUnavailable,
                'service_unavailable',
                'Account data is temporarily unavailable. Retry shortly.'
            ),
        };
    }
    if (stored === null)
        return {
            ok: false,
            failure: fail(
                API_STATUS.badRequest,
                'model_required',
                'Pass "model", or set an API default model at siglens.io/account.'
            ),
        };
    return isKnownApiModel(stored)
        ? { ok: true, model: stored }
        : {
              ok: false,
              failure: fail(
                  API_STATUS.badRequest,
                  'invalid_model',
                  'Your saved API default model is no longer available. Pass "model" or choose another default at siglens.io/account.',
                  { model: stored }
              ),
          };
}
