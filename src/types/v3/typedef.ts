import { GeneralDocument, DocumentNode } from '@rkesters/json-refs';
import { IncomingMessage } from 'http';
import { OpenAPIV3, IJsonSchema as IJsonSchemaApi } from 'openapi-types';
import { Modify } from '../typedefs';

export type SecurityRequirementObject = OpenAPIV3.SecurityRequirementObject;
export type SecuritySchemeObject = OpenAPIV3.SecuritySchemeObject;
export namespace DocumentApi {
    export type Document = OpenAPIV3.Document;

    export namespace resolved {
        export type Document = Modify<
            DocumentApi.Document,
            {
                paths: {
                    [index: string]: PathApi.resolved.PathItemObject;
                };
                components?: ComponentsApi.resolved.ComponentsObject;
                definitions?: { [index: string]: SchemaApi.resolved.SchemaObject };
            }
        >;
    }
}

export namespace ResponseApi {
    export type ResponseObject = OpenAPIV3.ResponseObject;
    export type ResponsesObject = OpenAPIV3.ResponsesObject;

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
    }
}
export namespace SecurityApi {
    export type SecurityRequirementObject = OpenAPIV3.SecurityRequirementObject;
    export type SecuritySchemeObject = OpenAPIV3.SecuritySchemeObject;
    export type SecurityDefinitionsObject = { [index: string]: SecuritySchemeObject };
}
export namespace ComponentsApi {
    export type ComponentsObject = OpenAPIV3.ComponentsObject;
    export namespace resolved {
        export type ComponentsObject = Modify<
            ComponentsApi.ComponentsObject,
            {
                schemas?: {
                    [key: string]: SchemaApi.resolved.SchemaObject;
                };
                responses?: {
                    [key: string]: ResponseApi.resolved.ResponseObject;
                };
                parameters?: {
                    [key: string]: ParameterApi.resolved.ParameterObject;
                };
                requestBodies?: {
                    [key: string]: RequestBodyApi.resolved.RequestBodyObject;
                };
                headers?: {
                    [key: string]: ParameterApi.resolved.HeaderObject;
                };
                callbacks?: {
                    [key: string]: CallbackApi.resolved.CallbackObject;
                };
            }
        >;
    }
}

export namespace SchemaApi {
    export type SchemaObject = OpenAPIV3.SchemaObject;
    export type IJsonSchema = IJsonSchemaApi;

    export namespace resolved {
        export type IJsonSchema = Omit<SchemaApi.IJsonSchema, '$ref'>;
        export type SchemaObject = Modify<
            SchemaApi.SchemaObject,
            {
                items: SchemaObject;
                properties?: {
                    [name: string]: SchemaObject;
                };
            }
        >;
    }
}

export namespace EncodingApi {
    export type EncodingObject = OpenAPIV3.EncodingObject;

    export namespace resolved {
        export type EncodingObject = Modify<
            EncodingApi.EncodingObject,
            {
                headers?: {
                    [header: string]: OpenAPIV3.HeaderObject;
                };
            }
        >;
    }
}

export namespace MediaTypeApi {
    export type MediaTypeObject = OpenAPIV3.MediaTypeObject;

    export namespace resolved {
        export type MediaTypeObject = Modify<
            MediaTypeApi.MediaTypeObject,
            {
                schema: SchemaApi.SchemaObject;
                examples?: {
                    [media: string]: OpenAPIV3.ExampleObject;
                };
                encoding?: {
                    [media: string]: EncodingApi.resolved.EncodingObject;
                };
            }
        >;
    }
}

export namespace RequestBodyApi {
    export type RequestBodyObject = OpenAPIV3.RequestBodyObject;

    export namespace resolved {
        export type RequestBodyObject = Modify<
            RequestBodyApi.RequestBodyObject,
            {
                content: {
                    [media: string]: MediaTypeApi.resolved.MediaTypeObject;
                };
            }
        >;
    }
}

export namespace CallbackApi {
    export type CallbackObject = OpenAPIV3.CallbackObject;
    export namespace resolved {
        export type CallbackObject = {
            [url: string]: PathApi.resolved.PathItemObject;
        };
    }
}

export namespace OperationApi {
    export type OperationObject = OpenAPIV3.OperationObject;
    export namespace resolved {
        export type OperationObject = Modify<
            OperationApi.OperationObject,
            {
                parameters?: ParameterApi.resolved.ParameterObject[];
                requestBody?: RequestBodyApi.resolved.RequestBodyObject;
                schema?: SchemaApi.SchemaObject;
                examples?: { [media: string]: OpenAPIV3.ExampleObject };
                callbacks?: {
                    [callback: string]: CallbackApi.resolved.CallbackObject;
                };
                responses?: ResponseApi.resolved.ResponsesObject;
            }
        >;
    }
}

export namespace ParameterApi {
    export type ParameterObject = OpenAPIV3.ParameterObject;
    export type HeaderObject = OpenAPIV3.HeaderObject;

    export namespace resolved {
        export type HeaderObject = Modify<
            ParameterApi.HeaderObject,
            {
                schema?: SchemaApi.SchemaObject;
                examples?: { [media: string]: OpenAPIV3.ExampleObject };
            }
        >;

        export type ParameterObject = Modify<
            ParameterApi.ParameterObject,
            {
                schema?: SchemaApi.resolved.SchemaObject;
                examples?: { [media: string]: OpenAPIV3.ExampleObject };
            }
        >;
    }
}
export namespace PathApi {
    export type PathObject = OpenAPIV3.PathsObject;
    export type PathItemObject = OpenAPIV3.PathItemObject;

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
