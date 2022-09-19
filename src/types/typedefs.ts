import { GeneralDocument, DocumentNode } from '@rkesters/json-refs';
import { IncomingMessage } from 'connect';
import * as v3 from './v3/typedef';
import * as v2 from './v2/typedef';
import { isError, isPlainObject, isString, isUndefined } from 'lodash';
import { ValidationEntry } from '../typedefs';

export {Modify} from '../typedefs';

type Codes =
    | 'INVALID_REQUEST_PARAMETER'
    | 'INVALID_TYPE'
    | 'INVALID_FORMAT'
    | 'EMPTY_NOT_ALLOWED'
    | 'INVALID_DEFINTION_DOCUMENT'
    | 'INVALID_DEFINTION';
type Args = {
    message: string;
    code?: Codes;
    path?: string[];
    in?: string;
    errors?: ValueError[];
    name?: string;
    failedValidation?: boolean;
};
function isArgs(value: unknown): value is Args {
    if (!isPlainObject(value)) {
        return false;
    }
    if (!(value as any).message) {
        return false;
    }

    return true;
}
export class ValueError extends Error implements ValidationEntry {
    code?: Codes;
    path?: string[];
    failedValidation: boolean = false;
    errors?: ValueError[];
    in?: string;

    static isa(value: unknown): value is ValueError {
        return isError(value);
    }
    static fromError(value: Error) {
        return new ValueError(value.message);
    }
    static from(value: string | Error | unknown): ValueError {
        return isString(value)
            ? new ValueError(value)
            : isError(value)
            ? ValueError.fromError(value)
            : new ValueError('Unknown Error');
    }

    constructor(message: Args);
    constructor(message: string);
    constructor(message?: string | Args) {
        const msg = isString(message) || isUndefined(message) ? message : message.message;
        super(msg);
        if (isArgs(message)) {
            this.code = message.code;
            this.path = message.path;
            this.in = message.in;
            this.errors = message.errors;
            this.name = message.name ?? 'ValueError';
            this.failedValidation = message.failedValidation ?? false;
        }
    }
}

// export type ClientRequest = IncomingMessage & {
//     body: string | GeneralDocument | DocumentNode[];
//     files: string[];
//     headers: Record<string, string>;
//     originalUrl: string;
//     query: Record<string, string | string[]>;
//     url: string;
// };

export namespace SecurityApi {
    export type SecurityRequirementObject =
        | v2.SecurityApi.SecurityRequirementObject
        | v3.SecurityApi.SecurityRequirementObject;
    export type SecuritySchemeObject =
        | v2.SecurityApi.SecuritySchemeObject
        | v3.SecurityApi.SecuritySchemeObject;
    export type SecurityDefinitionsObject =
        | v2.SecurityApi.SecurityDefinitionsObject
        | v3.SecurityApi.SecurityDefinitionsObject;
}

export namespace SchemaApi {
    export type SchemaObject = v2.SchemaApi.SchemaObject | v3.SchemaApi.SchemaObject;
    export type IJsonSchema = v2.SchemaApi.IJsonSchema | v3.SchemaApi.IJsonSchema;

    export namespace resolved {
        export type IJsonSchemaApi =
            | v2.SchemaApi.resolved.IJsonSchema
            | v3.SchemaApi.resolved.IJsonSchema;
        export type SchemaObject =
            | v2.SchemaApi.resolved.SchemaObject
            | v3.SchemaApi.resolved.SchemaObject;
    }
}

export namespace ResponseApi {
    export type ResponseObject = v2.ResponseApi.ResponseObject | v3.ResponseApi.ResponseObject;
    export type ResponsesObject = v2.ResponseApi.ResponsesObject | v3.ResponseApi.ResponsesObject;
    export type ResponsesDefinitionsObject = v2.ResponseApi.ResponsesDefinitionsObject;

    export namespace resolved {
        export type ResponseObject =
            | v2.ResponseApi.resolved.ResponseObject
            | v3.ResponseApi.resolved.ResponseObject;
        export type ResponsesObject =
            | v2.ResponseApi.resolved.ResponsesObject
            | v3.ResponseApi.resolved.ResponsesObject;
        export type ResponsesDefinitionsObject = v2.ResponseApi.resolved.ResponsesDefinitionsObject;
    }
}

export namespace DocumentApi {
    export type Document = v2.DocumentApi.Document | v3.DocumentApi.Document;

    export namespace resolved {
        export type Document = v2.DocumentApi.resolved.Document | v3.DocumentApi.resolved.Document;
    }
}

export namespace PathApi {
    export type PathObject = v2.PathApi.PathObject | v3.PathApi.PathObject;
    export type PathItemObject = v2.PathApi.PathItemObject | v3.PathApi.PathItemObject;

    export namespace resolved {
        export type PathObject = v2.PathApi.resolved.PathObject | v3.PathApi.resolved.PathObject;
        export type PathItemObject =
            | v2.PathApi.resolved.PathItemObject
            | v3.PathApi.resolved.PathItemObject;
    }
}

export namespace OperationApi {
    export type OperationObject = v2.OperationApi.OperationObject | v3.OperationApi.OperationObject;

    export namespace resolved {
        export type OperationObject =
            | v2.OperationApi.resolved.OperationObject
            | v3.OperationApi.resolved.OperationObject;
    }
}

export namespace ParameterApi {
    export type ParameterObject = v2.ParameterApi.ParameterObject | v3.ParameterApi.ParameterObject;
    export type HeaderObject = v2.ParameterApi.HeaderObject | v3.ParameterApi.HeaderObject;

    export namespace resolved {
        export type ParameterObject =
            | v2.ParameterApi.resolved.ParameterObject
            | v3.ParameterApi.resolved.ParameterObject;
        export type HeaderObject =
            | v2.ParameterApi.resolved.HeaderObject
            | v3.ParameterApi.resolved.HeaderObject;
    }
}
