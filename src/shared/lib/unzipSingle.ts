import { unzipSync } from 'fflate';

/** 단일 엔트리 zip에서 꺼낸 파일 하나. */
export interface UnzippedEntry {
    readonly name: string;
    readonly data: Uint8Array;
}

/** 형식이 기대(파일 정확히 하나, 크기 상한 이내)와 다른 zip. */
export class UnzipSingleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnzipSingleError';
    }
}

const isDirectory = (name: string): boolean => name.endsWith('/');

/**
 * 파일이 **정확히 하나**인 zip(SEC FTD `cnsfailsYYYYMMa.zip`, DART `corpCode.xml` zip)을 풀어 그 파일을 돌려준다.
 * 디렉터리 엔트리는 세지 않는다.
 *
 * 압축 해제 크기는 `maxBytes`로 묶는다 — 헤더(central directory)의 `originalSize`로 **풀기 전에** 거른다. fflate는 출력
 * 버퍼를 그 선언 크기로 잡고 넘치는 바이트는 버리므로(fflate 0.8.3 실측: 5,000바이트 엔트리를 10바이트로 선언하면 10바이트가
 * 나온다) 메모리는 이 검사로 묶인다. 대신 헤더가 크기를 **줄여** 선언한 zip은 조용히 잘린 내용을 돌려준다 — 내용 검증
 * (FTD trailer의 건수·합계 대조 등)은 호출부가 한다. 파일이 0개·2개 이상이거나 크기를 넘으면 `UnzipSingleError`, zip이
 * 깨졌으면 fflate의 오류를 그대로 던진다.
 */
export function unzipSingle(zip: Uint8Array, maxBytes: number): UnzippedEntry {
    const names: string[] = [];
    const files = unzipSync(zip, {
        filter: file => {
            if (isDirectory(file.name)) return false;
            names.push(file.name);
            if (file.originalSize > maxBytes) {
                throw new UnzipSingleError(
                    `zip entry ${file.name} is ${file.originalSize} bytes (limit ${maxBytes})`
                );
            }
            return true;
        },
    });
    if (names.length !== 1) {
        throw new UnzipSingleError(
            `expected exactly one file in zip, found ${names.length}`
        );
    }
    const [name] = names as [string];
    const data = files[name];
    if (data === undefined) {
        throw new UnzipSingleError(`zip entry ${name} was not extracted`);
    }
    return { name, data };
}
