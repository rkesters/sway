import { GeneralDocument, DocumentNode } from '@rkesters/json-refs';
import { IncomingMessage } from 'http';
import { OpenAPIV2, IJsonSchema as IJsonSchemaApi, OpenAPIV3 } from 'openapi-types';
import { Modify } from '../typedefs';

export type ClientRequest = IncomingMessage & {
    body: string | GeneralDocument | DocumentNode[];
    files: Record<string, string>;
    headers: Record<string, string>;
    originalUrl: string;
    query: Record<string, string | string[]>;
    url: string;
};

export namespace SecurityApi {
    export type SecurityRequirementObject = OpenAPIV2.SecurityRequirementObject;
    export type SecuritySchemeObject = OpenAPIV2.SecuritySchemeObject;
    export type SecurityDefinitionsObject = OpenAPIV2.SecurityDefinitionsObject;
}

export namespace DocumentApi {
    export type Document = OpenAPIV2.Document;

    export namespace resolved {
        export type Document = Modify<
            DocumentApi.Document,
            {
                paths: {
                    [index: string]: PathApi.resolved.PathItemObject;
                };
                definitions?: { [index: string]: SchemaApi.resolved.SchemaObject };
            }
        >;
    }
}

export namespace ItemsApi {
    export type ItemsObject = OpenAPIV2.ItemsObject;

    export namespace resolved {
        export type ItemsObject = Modify<
            Omit<ItemsApi.ItemsObject, '$ref'>,
            {
                items?: ItemsObject;
            }
        >;
    }
}

export namespace SchemaApi {
    export type SchemaObject = OpenAPIV2.SchemaObject;
    export type IJsonSchema = IJsonSchemaApi;

    export namespace resolved {
        export type IJsonSchema = Omit<SchemaApi.IJsonSchema, '$ref'>;
        export type SchemaObject = Modify<
            SchemaApi.SchemaObject,
            {
                items?: ItemsApi.resolved.ItemsObject;
                properties?: {
                    [name: string]: SchemaObject;
                };
            }
        >;
    }
}

export namespace ResponseApi {
    export type ResponseObject = OpenAPIV2.ResponseObject;
    export type ResponsesObject = OpenAPIV2.ResponsesObject;
    export type ResponsesDefinitionsObject = OpenAPIV2.ResponsesDefinitionsObject;

    export namespace resolved {
        export type ResponseObject = Modify<
            ResponseApi.ResponseObject,
            {
                schema?: SchemaApi.resolved.SchemaObject;
                headers?: ParameterApi.resolved.HeaderObject;
            }
        >;
        export type ResponsesObject = {
            [index: string]: ResponseObject | undefined;
            default?: ResponseObject;
        };
        export type ResponsesDefinitionsObject = {
            [index: string]: ResponseObject;
        };
    }
}
export namespace OperationApi {
    export type OperationObject = OpenAPIV2.OperationObject;
    export namespace resolved {
        export type OperationObject = Modify<
            OperationApi.OperationObject,
            {
                parameters?: ParameterApi.resolved.ParameterObject[];
                schema?: SchemaApi.SchemaObject;
            }
        >;
    }
}

export namespace ParameterApi {
    export type ParameterObject = OpenAPIV2.ParameterObject;
    export type HeaderObject = OpenAPIV2.HeaderObject;

    export namespace resolved {
        export type HeaderObject = Modify<
            ParameterApi.HeaderObject,
            { schema?: SchemaApi.SchemaObject }
        >;

        export type ParameterObject = Modify<
            ParameterApi.ParameterObject,
            {
                schema?: SchemaApi.resolved.SchemaObject;
                collectionFormat?: 'csv' | 'ssv' | 'tsv' | 'pipes' | 'multi';
            }
        >;
    }
}
export namespace PathApi {
    export type PathObject = OpenAPIV2.PathsObject;
    export type PathItemObject = OpenAPIV2.PathItemObject;

    export namespace resolved {
        export type PathObject = {
            [index: string]: PathItemObject;
        };
        export type PathItemObject = Modify<
            PathApi.PathItemObject,
            { parameters: ParameterApi.resolved.ParameterObject[] }
        >;
    }
}
