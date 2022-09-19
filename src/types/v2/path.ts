import { SwaggerApi } from './api';
import { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import _ from 'lodash';
import JsonRefs from '@rkesters/json-refs';
import { Key, pathToRegexp } from 'path-to-regexp';
import { IParameter, Parameter } from './parameter';
import { IOperation, Operation } from './operation';
import { DocumentApi, OperationApi, ParameterApi, PathApi, SecurityApi } from './typedef';
import { Path as BasePath } from '../path';

export type IPath = BasePath<
DocumentApi.resolved.Document,
PathApi.PathItemObject,
PathApi.resolved.PathItemObject,
OperationApi.OperationObject,
OperationApi.resolved.OperationObject,
ParameterApi.ParameterObject,
ParameterApi.resolved.ParameterObject,
SecurityApi.SecurityRequirementObject
>;

export class Path
    implements
    IPath
{
    #basePathPrefix: string;
    #sanitizedPath: string;

    #api: SwaggerApi;
    #definition: PathApi.PathItemObject;
    #definitionFullyResolved: PathApi.resolved.PathItemObject;
    #path: string;
    #keys: Key[];
    #pathToDefinition: string[];
    #ptr: string;
    #regexp: RegExp;
    #debug: debug.Debugger;
    #parameterObjects: IParameter[] = [];
    #operationObjects: IOperation[] = [];

    public get parameterObjects() {
        return this.#parameterObjects;
    }

    public get operationObjects() {
        return this.#operationObjects;
    }

    public get path(): string {
        return this.#path;
    }

    public get regexp(): RegExp {
        return this.#regexp;
    }
    public get keys(): Key[] {
        return this.#keys;
    }

    public get api() {
        return this.#api;
    }

    constructor(
        api: SwaggerApi,
        path: string,
        definition: PathApi.PathItemObject,
        definitionFullyResolved: PathApi.resolved.PathItemObject,
        pathToDefinition: string[]
    ) {
        this.#basePathPrefix = _.get(api.definitionFullyResolved, 'basePath', '/');

        if (this.#basePathPrefix.startsWith('/')) {
            this.#basePathPrefix = this.#basePathPrefix.substring(
                0,
                this.#basePathPrefix.length - 1
            );
        }

        this.#sanitizedPath =
            this.#basePathPrefix +
            path
                .replace('(', '\\(') // path-to-regexp
                .replace(')', '\\)') // path-to-regexp
                .replace(':', '\\:') // path-to-regexp
                .replace('*', '\\*') // path-to-regexp
                .replace('+', '\\+') // path-to-regexp
                .replace('?', '\\?') // path-to-regexp
                .replace(/\{/g, ':') // Swagger -> Express-style
                .replace(/\}/g, ''); // Swagger -> Express-style

        // Assign local properties
        this.#api = api;
        this.#definition = definition;
        this.#definitionFullyResolved = definitionFullyResolved;
        this.#path = path;
        this.#pathToDefinition = pathToDefinition;
        this.#ptr = JsonRefs.pathToPtr(pathToDefinition);
        this.#keys = [];
        this.#regexp = pathToRegexp(this.#sanitizedPath, this.#keys, {
            sensitive: true,
        });

        this.#debug = api.debug;
        this.#debug(`    ${this.#path}`);

        const params: ParameterApi.resolved.ParameterObject[] = definitionFullyResolved.parameters;

        this.#parameterObjects = _.map(definitionFullyResolved.parameters, (paramDef, index) => {
            const pPath = pathToDefinition.concat(['parameters', index.toString()]);

            return new Parameter(
                this,
                _.get(api.definitionRemotesResolved, pPath),
                paramDef,
                pPath
            );
        });
    }

    get definition(): PathApi.PathItemObject {
        return this.#definition;
    }
    get definitionFullyResolved(): PathApi.resolved.PathItemObject {
        return this.#definitionFullyResolved;
    }
    get pathToDefinition(): string[] {
        return this.#pathToDefinition;
    }
    get ptr(): string {
        return this.#ptr;
    }

    /**
     * Return the operation for this path and operation id or method.
     *
     * @param idOrMethod - The operation id or method
     *
     * @returns  The `Operation` objects for this path and method or `undefined` if there is no
     * operation for the provided method
     */
    public getOperation(idOrMethod: string): IOperation | undefined {
        return _.find(this.operationObjects, (operationObject) => {
            return (
                operationObject.operationId === idOrMethod ||
                operationObject.method === idOrMethod.toLowerCase()
            );
        });
    }

    /**
     * Return the operations for this path and tag.
     *
     * @param tag - The tag
     *
     * @returns The `Operation` objects for this path and tag
     */
    getOperationsByTag(tag: string): IOperation[] {
        return _.filter(this.operationObjects, function (operationObject) {
            return _.includes(operationObject.tags, tag);
        });
    }

    /**
     * Return the parameters for this path.
     *
     * @returns   The `Parameter` objects for this path
     */
    getParameters(): IParameter[] {
        return this.parameterObjects;
    }
}
