import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `twitter` 메타데이터 객체는 `buildTwitterMetadata`로만 만든다. Next는 `twitter`를 부모와
 * 병합하지 않고 통째로 교체하므로, 손으로 쓴 객체 하나가 `twitter:site`를 조용히 잃는다.
 * 소스를 훑어 `twitter: {` 리터럴(객체 직접 선언)이 남아 있지 않은지 강제한다.
 */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            return name === '__tests__' || name === 'node_modules'
                ? []
                : sourceFiles(path);
        }
        return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
}

describe('twitter 메타데이터 가드', () => {
    const files = sourceFiles('src');

    it('`twitter: {` 객체 리터럴로 직접 선언한 곳이 없다', () => {
        const offenders = files.filter(file =>
            /\btwitter:\s*\{/.test(readFileSync(file, 'utf8'))
        );
        expect(offenders).toEqual([]);
    });

    it('`twitter:`를 선언하는 모든 파일이 buildTwitterMetadata를 쓴다', () => {
        const declaring = files.filter(file =>
            /\btwitter:\s/.test(readFileSync(file, 'utf8'))
        );
        expect(declaring.length).toBeGreaterThan(5);
        const missing = declaring.filter(
            file => !readFileSync(file, 'utf8').includes('buildTwitterMetadata')
        );
        expect(missing).toEqual([]);
    });
});
