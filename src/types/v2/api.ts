import debug from 'debug';
import { get, has, isString, map } from 'lodash';
import { ISwaggerApi } from '../api';
import { DocumentApi, OperationApi, ParameterApi, PathApi, SecurityApi } from './typedef';
import { ValueError } from '../typedefs';
import { Path } from './path';

//export type IPath =  Path<DocumentApi.resolved.Document, PathApi.PathItemObject, PathApi.resolved.PathItemObject>  [] = [];

/**
 *
 * @param doc  APi documents that us to be version checked.
 * @returns true if it pass basic check for being a swagger 2 defintion.
 */
export function isOpenApi(doc: unknown): doc is DocumentApi.Document {
    if (has(doc, 'swagger') && get(doc, 'swagger').startsWith('2')) {
        return true;
    }

    return false;
}

export class SwaggerApi
    implements
        ISwaggerApi<
        DocumentApi.resolved.Document,
        PathApi.PathItemObject,
        PathApi.resolved.PathItemObject,
        OperationApi.OperationObject,
        OperationApi.resolved.OperationObject,
        ParameterApi.ParameterObject,
        ParameterApi.resolved.ParameterObject,
        SecurityApi.SecurityRequirementObject
        >
{
    static isa(value: unknown): value is SwaggerApi {
        return value instanceof SwaggerApi;
    }

    #definition: DocumentApi.Document;
    #definitionRemotesResolved: DocumentApi.resolved.Document;
    #definitionFullyResolved: DocumentApi.resolved.Document;
    #references: object;
    #options: object;
    #customFormats: object;
    #customFormatGenerators: object;

    #customValidators: object;
    #documentationUrl: string;
    #pathObjects: Path[] = [];
    #version: string;
    #error?: ValueError;
    #debug: debug.Debugger;
    #paths: Record<string, Path> = {};

    get error(): ValueError | undefined {
        return this.#error;
    }
    get isValid(): boolean {
        return !(this.error ?? false);
    }
    get debug(): debug.Debugger {
        return this.#debug;
    }

    get definitionFullyResolved(): DocumentApi.resolved.Document {
        return this.#definitionFullyResolved;
    }

    get definitionRemotesResolved(): DocumentApi.resolved.Document {
        return this.#definitionRemotesResolved;
    }

    get produces(): string[] | undefined {
        return get(this.#definitionFullyResolved, 'produces');
    }

    get consumes(): string[] | undefined {
        return get(this.#definitionFullyResolved, 'comsumes');
    }

    constructor(
        definition: DocumentApi.Document,
        definitionRemotesResolved: DocumentApi.resolved.Document,
        definitionFullyResolved: DocumentApi.resolved.Document,
        references: any,
        options: any
    ) {
        debug(
            `Creating SwaggerApi from ${
                isString(options.definition) ? options.definition : 'the provided document'
            }`
        );

        this.#debug = debug('swayV2');

        this.#customFormats = {};
        this.#customFormatGenerators = {};
        this.#customValidators = [];
        this.#definition = definition;
        this.#definitionFullyResolved = definitionFullyResolved;
        this.#definitionRemotesResolved = definitionRemotesResolved;
        this.#documentationUrl =
            'https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md';
        this.#options = options;
        this.#references = references;
        this.#version = get(this.#definition, 'swagger', '0.0');

        if (!isOpenApi(this.#definition)) {
            this.#error = new ValueError(
                'Provided swagger document is not a valid version 2, document. '
            );
            this.#error.code = 'INVALID_DEFINTION_DOCUMENT';
            return;
        }

        this.#pathObjects = map(
            definitionFullyResolved.paths,
            (pathDef: PathApi.resolved.PathItemObject, path: string) => {
                return new Path(this, path, get(definition, ['paths', path]), pathDef, [
                    'paths',
                    path,
                ]);
            }
        );
    }

    public get path(): Record<string, Path> {
        return this.#paths;
    }
}
