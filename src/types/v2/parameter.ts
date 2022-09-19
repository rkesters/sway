import { IPath, Path } from './path';
import { OpenAPI, OpenAPIV2, OpenAPIV3 } from 'openapi-types';
import JsonRefs from '@rkesters/json-refs';
import * as _ from 'lodash';
import { IOperation, Operation } from './operation';
import { getHeaderValue, getSample, parameterLocations } from '../../helpers';
import { parse as parseUrl } from 'url';

import { IParameterValue, ParameterValue } from './parameterValue';
import {
    ClientRequest,
    DocumentApi,
    OperationApi,
    ParameterApi,
    PathApi,
    SchemaApi,
    SecurityApi,
} from './typedef';
import { Parameter as BaseParameter } from '../parameter';
import { isPlainObject } from 'lodash';

export type IParameter = BaseParameter<
    ParameterApi.ParameterObject,
    ParameterApi.resolved.ParameterObject,
    DocumentApi.resolved.Document,
    PathApi.PathItemObject,
    PathApi.resolved.PathItemObject,
    OperationApi.OperationObject,
    OperationApi.resolved.OperationObject,
    SecurityApi.SecurityRequirementObject
>;

export class Parameter implements IParameter {
    static readonly #parameterSchemaProperties: (keyof SchemaApi.resolved.SchemaObject)[] = [
        'allowEmptyValue',
        'default',
        'description',
        'enum',
        'exclusiveMaximum',
        'exclusiveMinimum',
        'format',
        'items',
        'maxItems',
        'maxLength',
        'maximum',
        'minItems',
        'minLength',
        'minimum',
        'multipleOf',
        'pattern',
        'type',
        'uniqueItems',
    ];
    #definition: ParameterApi.ParameterObject;
    #definitionFullyResolved: ParameterApi.resolved.ParameterObject;
    #pathToDefinition: string[];
    #ptr: string;
    #operationObject?: IOperation;
    #pathObject: IPath;
    #schema?:SchemaApi.resolved.SchemaObject;

    get definition() {
        return this.#definition;
    }

    get definitionFullyResolved() {
        return this.#definitionFullyResolved;
    }

    get operationObject() {
        return this.#operationObject;
    }

    get pathObject() {
        return this.#pathObject;
    }

    get pathToDefinition() {
        return this.#pathToDefinition;
    }
    get schema(): SchemaApi.resolved.SchemaObject | undefined {
        return  this.#schema ?? _.get(this.#definitionFullyResolved, 'schema');
    }

    get ptr(): string {
        return this.#ptr;
    }
    get collectionFormat():  'csv' | 'ssv' | 'tsv' | 'pipes' | 'multi' {
        return _.get(this.#definitionFullyResolved, 'collectionFormat', 'csv');
    }
    get allowEmptyValue(): boolean {
        return _.get(this.#definitionFullyResolved, 'allowEmptyValue', false);
    }
    get in(): "query" | "header" |"path" | "formData" | "body" {
        return _.get(this.#definitionFullyResolved, 'in');
    }
    get name(): string {
        return _.get(this.#definitionFullyResolved, 'name');
    }
    get description(): string | undefined {
        return _.get(this.#definitionFullyResolved, 'description');
    }
    get required(): boolean {
        return _.get(this.#definitionFullyResolved, 'required', false);
    }
    get format(): undefined | string {
        return _.get(this.#definitionFullyResolved, 'format', this.schema?.format);
    }
    get type(): undefined | string {
        return _.get(this.#definitionFullyResolved, 'type', this.schema?.type);
    }



    constructor(
        opOrPathObject: Operation | Path,
        definition: ParameterApi.ParameterObject,
        definitionFullyResolved: ParameterApi.resolved.ParameterObject,
        pathToDefinition: string[]
    ) {
        // Assign local properties
        this.#definition = definition;
        this.#definitionFullyResolved = definitionFullyResolved;
        this.#pathToDefinition = pathToDefinition;
        this.#ptr = JsonRefs.pathToPtr(pathToDefinition);

        if (Operation.isOperation(opOrPathObject)) {
            this.#operationObject = opOrPathObject;
            this.#pathObject = opOrPathObject.pathObject;
        } else {
            this.#operationObject = undefined;
            this.#pathObject = opOrPathObject;
        }

        // Assign local properties from the Swagger definition properties
        _.assign(this, definitionFullyResolved);

        if (_.isUndefined(_.get(this.#definitionFullyResolved, 'schema'))) {
            this.#schema = this.computeParameterSchema(definitionFullyResolved);
        }

        this.#pathObject.api.debug(
            '          %s%s (in: %s) at %s',
            _.isUndefined(this.#operationObject) ? '' : '  ',
            definitionFullyResolved.name,
            definitionFullyResolved.in,
            this.#ptr
        );
    }

    /**
     * Helper method to take a Swagger parameter definition and compute its schema.
     *
     * For non-body Swagger parameters, the definition itself is not suitable as a JSON Schema so we must compute it.
     *
     * @param {ParameterApi.resolved.ParameterObject} paramDef - The parameter definition
     *
     * @returns {SchemaApi.resolved.SchemaObject} The computed schema
     */
    private computeParameterSchema(paramDef: ParameterApi.resolved.ParameterObject): SchemaApi.resolved.SchemaObject {
        return _.isUndefined(paramDef.schema)
            ? Parameter.#parameterSchemaProperties.reduce((acc: SchemaApi.resolved.SchemaObject, name) => {
                  if (!_.isUndefined(paramDef[name])) {
                      acc[name] = paramDef[name];
                  }
                  return acc;
              }, {})
            : paramDef.schema;
    }
    /**
     * Returns a sample value for the parameter based on its schema;
     *
     * @returns {*} The sample value
     */
    public getSample() {
        return getSample(this.schema);
    }

    /**
     * Returns the parameter value from the request.
     *
     * **Note:** Below is the list of `req` properties used *(req should be an `http.ClientRequest` or equivalent)*:
     *
     *   * `body`: Used for `body` and `formData` parameters
     *   * `files`: Used for `formData` parameters whose `type` is `file`
     *   * `headers`: Used for `header` parameters
     *   * `originalUrl`: used for `path` parameters
     *   * `query`: Used for `query` parameters
     *   * `url`: used for `path` parameters
     *
     * For `path` parameters, we will use the operation's `regexp` property to parse out path parameters using the
     * `originalUrl` or `url` property.
     *
     * *(See: {@link https://nodejs.org/api/http.html#http_class_http_clientrequest})*
     *
     * @param {object} req - The http client request *(or equivalent)*
     *
     * @returns {module:sway.ParameterValue} The parameter value object
     *
     * @throws {Error} If the `in` value of the parameter's schema is not valid or if the `req` property to retrieve the
     * parameter is missing
     */
    public getValue(req: ClientRequest): IParameterValue {
        if (_.isUndefined(req)) {
            throw new TypeError('req is required');
        } else if (!_.isObject(req)) {
            throw new TypeError('req must be an object');
        } else if (parameterLocations.indexOf(this.in) === -1) {
            throw new Error("Invalid 'in' value: " + this.in);
        }

        // We do not need to explicitly check the type of req

        const type = this.type;
        let pathMatch;
        let value;

        switch (this.in) {
            case 'body':
                value = req.body;
                break;
            case 'formData':
                // For formData, either the value is a file or a property of req.body.  req.body as a whole can never be the
                // value since the JSON Schema for formData parameters does not allow a type of 'object'.
                if (type === 'file') {
                    if (_.isUndefined(req.files)) {
                        if (this.required) {
                            throw new Error(
                                "req.files must be provided for 'formData' parameters of type 'file'"
                            );
                        } else {
                            break;
                        }
                    }

                    value = req.files[this.name];
                } else {
                    if (_.isUndefined(req.body)) {
                        if (this.required) {
                            throw new Error("req.body must be provided for 'formData' parameters");
                        } else {
                            break;
                        }
                    }
                    value = (req.body as any)[this.name];
                }
                break;
            case 'header':
                if (_.isUndefined(req.headers)) {
                    if (this.required) {
                        throw new Error("req.headers must be provided for 'header' parameters");
                    } else {
                        break;
                    }
                }

                value = getHeaderValue(req.headers, this.name);
                break;
            case 'path':
                if (_.isUndefined(req.originalUrl) && _.isUndefined(req.url)) {
                    throw new Error(
                        "req.originalUrl or req.url must be provided for 'path' parameters"
                    );
                }
                const url = req.originalUrl ?? req.url ?? '';
                pathMatch = this.#pathObject.regexp.exec(parseUrl(url).pathname ?? '');

                if (pathMatch) {
                    // decode URI component here to avoid issues with encoded slashes
                    value = decodeURIComponent(
                        pathMatch[
                            _.findIndex(this.#pathObject.keys, (key) => {
                                return key.name === this.name;
                            }) + 1
                        ]
                    );
                }
                break;
            case 'query':
                if (_.isUndefined(req.query)) {
                    if (this.required) {
                        throw new Error("req.query must be provided for 'query' parameters");
                    } else {
                        break;
                    }
                }

                value = _.get(req.query, this.name);

                break;

            // no default
        }

        return new ParameterValue(this, value);
    }
}
