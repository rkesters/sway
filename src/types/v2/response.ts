import { OpenAPI } from 'openapi-types';
import { IOperation, Operation } from './operation';
import JsonRefs from '@rkesters/json-refs';
import _, { isEmpty, isError } from 'lodash';
import YAML from 'js-yaml';
import {
    convertValue,
    getContentType,
    getJSONSchemaValidator,
    getSample,
    processValidators,
    validateAgainstSchema,
    validateContentType,
    validateOptionsAllAreFunctions,
    validateStrictMode,
} from '../../helpers';
import {
    DocumentApi,
    OperationApi,
    ParameterApi,
    PathApi,
    ResponseApi,
    SecurityApi,
} from './typedef';
import { Response as BaseResponse } from '../response';
import { isValidationEntry, ResponseValidationOptions, ServerResponseWrapper, ValidationEntry, ValidationResults } from '../../typedefs';
import { ValueError } from '../typedefs';
import { SchemaError } from 'z-schema';

const jsonValidator = getJSONSchemaValidator();
export type IResponse = BaseResponse<
    ResponseApi.ResponseObject,
    ResponseApi.resolved.ResponseObject,
    OperationApi.OperationObject,
    OperationApi.resolved.OperationObject,
    SecurityApi.SecurityRequirementObject,
    DocumentApi.resolved.Document,
    PathApi.PathItemObject,
    PathApi.resolved.PathItemObject,
    ParameterApi.ParameterObject,
    ParameterApi.resolved.ParameterObject
>;

export class Response implements IResponse {
    definition: ResponseApi.ResponseObject;
    definitionFullyResolved: ResponseApi.resolved.ResponseObject;
    operationObject: IOperation;
    pathToDefinition: string[];
    ptr: string;
    statusCode: string;
    headers: Record<string, any> = {};

    constructor(
        operationObject: IOperation,
        statusCode: string,
        definition: ResponseApi.ResponseObject,
        definitionFullyResolved: ResponseApi.resolved.ResponseObject,
        pathToDefinition: string[]
    ) {
        this.definition = definition;
        this.definitionFullyResolved = definitionFullyResolved;
        this.operationObject = operationObject;
        this.pathToDefinition = pathToDefinition;
        this.ptr = JsonRefs.pathToPtr(pathToDefinition);
        this.statusCode = statusCode;

        // Assign local properties from the Swagger definition properties
        _.assign(this, definitionFullyResolved);
    }

    /**
     * Returns the response example for the mime-type.
     *
     * @param {string} [mimeType] - The mime type
     *
     * @returns {string} The response example as a string or `undefined` if the response code and/or mime-type is missing
     */
    getExample (mimeType: string): string | undefined {
        var example;

        if (!_.isUndefined (this.definitionFullyResolved.examples)) {
            example = this.definitionFullyResolved.examples[mimeType];
        }

        if (!_.isUndefined(example) && !_.isString(example)) {
            if (mimeType === 'application/json') {
                example = JSON.stringify(example, null, 2);
            } else if (mimeType === 'application/x-yaml') {
                example = YAML.dump(example, { indent: 2 });
            }
        }
        return example;
    };

    /**
     * Returns a sample value.
     *
     * @returns {*} The sample value for the response, which can be undefined if the response schema is not provided
     */
    getSample() {
        return getSample(this.definitionFullyResolved.schema);
    }

    /**
     * Validates the response.
     *
     * @param {module:sway.ServerResponseWrapper} res - The response or response like object
     * @param {module:sway.ResponseValidationOptions} [options] - The validation options
     *
     * @returns {module:sway.ValidationResults} The validation results
     */
    validateResponse(res:ServerResponseWrapper, options:ResponseValidationOptions = {strictMode:false}): ValidationResults {
        const results: ValidationResults = {
            errors: [],
            warnings: [],
        };
        let bodyValue;
        let bvResults;

        if (_.isUndefined(res)) {
            throw new TypeError('res is required');
        } else if (!_.isObject(res)) {
            throw new TypeError('res must be an object');
        } else if (!_.isUndefined(options) && !_.isPlainObject(options)) {
            throw new TypeError('options must be an object');
        } else if (!_.isUndefined(options) && !_.isUndefined(options.customValidators)) {
            if (!_.isArray(options.customValidators)) {
                throw new TypeError('options.customValidators must be an array');
            }

            validateOptionsAllAreFunctions(options.customValidators, 'customValidators');
        }


        if (_.isUndefined(res.headers)) {
            res.headers = {};
        }

        // Validate the Content-Type except for void responses, 204 responses and 304 responses as they have no body
        if (
           !isEmpty (this.operationObject.produces) &&
            !_.isUndefined(res.body) &&
            !_.isUndefined(this.definitionFullyResolved.schema) &&
            _.indexOf(['204', '304'], this.statusCode) === -1
        ) {
            validateContentType(
                getContentType(res.headers),
                this.operationObject.produces,
                results
            );
        }

        // Validate the response headers
        _.forEach(this.headers, function (schema, name) {
            let headerValue;
            let hvResults;

            try {
                headerValue = convertValue(
                    schema,
                    {
                        collectionFormat: schema.collectionFormat,
                    },
                    // Overly cautious
                    res.headers[name.toLowerCase()] || res.headers[name] || schema.default
                );
            } catch (error) {
                const err = isValidationEntry(error) ? error : new ValueError (isError(error) ? error.message : `Unknown error of type ${typeof error}`)
                results.errors.push({
                    code: 'INVALID_RESPONSE_HEADER',
                    errors: err.errors ?? [
                      (  {
                            code: err.code,
                            message: err.message,
                            path: err.path,
                        } as ValidationEntry),
                    ],
                    message: 'Invalid header (' + name + '): ' + err.message,
                    name: name,
                    path: err.path,
                });
            }

            // Due to ambiguity in the Swagger 2.0 Specification (https://github.com/swagger-api/swagger-spec/issues/321), it
            // is probably not a good idea to do requiredness checks for response headers.  This means we will validate
            // existing headers but will not throw an error if a header is defined in a response schema but not in the response.
            //
            // We also do not want to validate date objects because it is redundant.  If we have already converted the value
            // from a string+format to a date, we know it passes schema validation.
            if (!_.isUndefined(headerValue) && !_.isDate(headerValue)) {
                hvResults = validateAgainstSchema(jsonValidator, schema, headerValue);

                if (hvResults.errors.length > 0) {
                    results.errors.push({
                        code: 'INVALID_RESPONSE_HEADER',
                        errors: hvResults.errors,
                        // Report the actual error if there is only one error.  Otherwise, report a JSON Schema
                        // validation error.
                        message:
                            'Invalid header (' +
                            name +
                            '): ' +
                            (hvResults.errors.length > 1
                                ? 'Value failed JSON Schema validation'
                                : hvResults.errors[0].message),
                        name: name,
                        path: [],
                    });
                }
            }
        });

        // Validate response for non-void responses
        if (
            !_.isUndefined(this.definitionFullyResolved.schema) &&
            _.indexOf(['204', '304'], this.statusCode) === -1
        ) {
            try {
                bodyValue = convertValue(
                    this.definitionFullyResolved.schema,
                    {
                        encoding: res.encoding,
                    },
                    res.body
                );
                bvResults = validateAgainstSchema(
                    getJSONSchemaValidator(),
                    this.definitionFullyResolved.schema,
                    bodyValue
                );
            } catch (err) {
                bvResults = {
                    errors: [
                        {
                            code: err.code,
                            message: err.message,
                            path: err.path,
                        },
                    ],
                };
            }

            if (bvResults.errors.length > 0) {
                results.errors.push({
                    code: 'INVALID_RESPONSE_BODY',
                    errors: bvResults.errors,
                    message:
                        'Invalid body: ' +
                        (bvResults.errors.length > 1
                            ? 'Value failed JSON Schema validation'
                            : bvResults.errors[0].message),
                    path: [],
                });
            }
        }

        // Validate strict mode
        validateStrictMode(this, res, options.strictMode, results);

        // Process custom validators
        processValidators(res, this, options.customValidators, results);

        return results;
    }
}