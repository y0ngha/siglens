import { describe, expect, it } from 'vitest';
import { PUBLIC_API_DOC_PATHS } from '@/shared/config/publicApi';
import { SKILL_FILE_NAME } from '../developersContent';
import { DEVELOPER_DOWNLOAD_PATHS, downloadFileName } from '../downloads';

describe('downloadFileName', () => {
    it('strips the leading slash from the OpenAPI paths', () => {
        expect(downloadFileName(PUBLIC_API_DOC_PATHS.openapiJson)).toBe(
            'openapi.json'
        );
        expect(downloadFileName(PUBLIC_API_DOC_PATHS.openapiYaml)).toBe(
            'openapi.yaml'
        );
    });

    it('names the extensionless skill path SKILL.md', () => {
        expect(downloadFileName(PUBLIC_API_DOC_PATHS.skill)).toBe(
            SKILL_FILE_NAME
        );
    });
});

describe('DEVELOPER_DOWNLOAD_PATHS', () => {
    it('lists JSON, YAML and the skill in that order', () => {
        expect(DEVELOPER_DOWNLOAD_PATHS).toEqual([
            '/openapi.json',
            '/openapi.yaml',
            '/skill',
        ]);
    });
});
