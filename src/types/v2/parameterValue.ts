/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Apigee Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import * as helpers from '../../helpers';
import JsonRefs from '@rkesters/json-refs';
import { IParameter, Parameter } from './parameter';
import { every, isArray, isDate, isError, isFunction, isUndefined, reduce } from 'lodash';
import {
    DocumentApi,
    OperationApi,
    ParameterApi,
    PathApi,
    SecurityApi,
    ValueError,
} from '../typedefs';
import { ParameterValue as BaseParameterValue } from '../parameterValue';

export type IParameterValue = BaseParameterValue<
    ParameterApi.ParameterObject,
    ParameterApi.resolved.ParameterObject,
    DocumentApi.resolved.Document,
    PathApi.PathItemObject,
    PathApi.resolved.PathItemObject,
    OperationApi.OperationObject,
    OperationApi.resolved.OperationObject,
    SecurityApi.SecurityRequirementObject
>;

export class ParameterValue implements IParameterValue {
    /**
     * Object representing a parameter value.
     *
     * **Note:** Do not use directly.
     *
     * @param {module:sway.Parameter} parameterObject - The `Parameter` object
     * @param {*} raw - The original/raw value
     *
     * @property {Error} error - The error(s) encountered during processing/validating the parameter value
     * @property {module:sway.Parameter} parameterObject - The `Parameter` object
     * @property {*} raw - The original parameter value *(Does not take default values into account)*
     * @property {boolean} valid - Whether or not this parameter is valid based on its JSON Schema
     * @property {*} value - The processed value *(Takes default values into account and does type coercion when necessary
     * and possible)*.  This can the original value in the event that processing the value is impossible
     * *(missing schema type)* or `undefined` if processing the value failed *(invalid types, etc.)*.
     *
     * @constructor
     *
     * @memberof module:sway
     */
    constructor(parameterObject: IParameter, raw: any) {
        this.#parameterObject = parameterObject;
        this.#raw = raw;
    }

    #raw: any;
    #valid: boolean = true;
    #errors: ValueError[] = [];
    #error?: ValueError;
    #isValid: boolean | undefined = undefined;
    #parameterObject: IParameter;
    #processed = false;
    #processedValue: any;

    public get parameterObject() {
        return this.#parameterObject;
    }

    public get raw() {
        return this.#raw;
    }

    public get valid(): boolean {
        let result = {
            errors: [],
            warnings: [],
        };
        let skipValidation = false;
        let value;
        let vError: any;
        const schema = this.#parameterObject.schema;
        const pPath = JsonRefs.pathFromPtr(this.#parameterObject.ptr);

        if (!schema) {
            this.#error = new ValueError({
                message: `Parameter does not have required schema ${this.#parameterObject.pathToDefinition.join(
                    '/'
                )}`,
                code: 'INVALID_DEFINTION',
                path: this.#parameterObject.pathToDefinition,
            });
            this.#isValid = false;
            return false;
        }

        if (isUndefined(this.#isValid)) {
            this.#isValid = true;
            value = this.value;

            if (isUndefined(this.error)) {
                try {
                    // Validate requiredness
                    if (this.#parameterObject.required === true && isUndefined(value)) {
                        vError = new Error('Value is required but was not provided');

                        vError.code = 'REQUIRED';

                        throw vError;
                    }

                    // Cases we do not want to do schema validation:
                    //
                    //   * The schema explicitly allows empty values and the value is empty
                    //   * The schema allow optional values and the value is undefined
                    //   * The schema defines a file parameter
                    //   * The schema is for a string type with date/date-time format and the value is a date
                    //   * The schema is for a string type and the value is a Buffer
                    if (
                        (isUndefined(this.#parameterObject.required) ||
                            this.#parameterObject.required === false) &&
                        isUndefined(value)
                    ) {
                        skipValidation = true;
                    } else if (this.#parameterObject.allowEmptyValue === true && value === '') {
                        skipValidation = true;
                    } else if (this.#parameterObject.type === 'file') {
                        skipValidation = true;
                    } else if (schema.type === 'string') {
                        if (['date', 'date-time'].includes(schema.format) && isDate(value)) {
                            skipValidation = true;
                        } else if (schema.type === 'string' && isFunction(value.readUInt8)) {
                            skipValidation = true;
                        }
                    }

                    if (!skipValidation) {
                        // Validate against JSON Schema
                        result = helpers.validateAgainstSchema(
                            helpers.getJSONSchemaValidator(),
                            this.#parameterObject.schema,
                            value
                        );
                    }

                    if (result.errors.length > 0) {
                        vError = new Error('Value failed JSON Schema validation');

                        vError.code = 'SCHEMA_VALIDATION_FAILED';
                        vError.errors = result.errors;

                        throw vError;
                    }
                } catch (e) {
                    const err: ValueError = ValueError.isa(e)
                        ? e
                        : isError(e)
                        ? new ValueError(e.message)
                        : new ValueError('Unknown error caught');
                    err.failedValidation = true;
                    err.path = pPath;

                    this.#error = err;
                    this.#isValid = false;
                }
            } else {
                this.#isValid = false;
            }
        }

        return this.#isValid;
    }

    public get value() {
        let vError: ValueError;
        const schema = this.#parameterObject.schema;

        if (!schema) {
            throw new ValueError({
                message: `Parameter does not have required schema ${this.#parameterObject.pathToDefinition.join(
                    '/'
                )}`,
                code: 'INVALID_DEFINTION',
                path: this.#parameterObject.pathToDefinition,
            });
        }

        if (!this.#processed && schema) {
            if (schema.type === 'file') {
                this.#processedValue = this.#raw;
            } else {
                // Convert/Coerce the raw value from the request object
                try {
                    // Validate emptiness (prior to coercion for better error handling)
                    if (this.#parameterObject.allowEmptyValue === false && this.#raw === '') {
                        vError = new ValueError('Value is not allowed to be empty');

                        vError.code = 'EMPTY_NOT_ALLOWED';

                        // Since this error is not a coercion error, the value is set to raw
                        if (schema.type === 'string') {
                            this.#processedValue = this.#raw;
                        }

                        throw vError;
                    }

                    this.#processedValue = helpers.convertValue(
                        schema,
                        {
                            collectionFormat: this.#parameterObject.collectionFormat,
                        },
                        this.#raw
                    );
                } catch (err) {
                    this.#error = ValueError.from(err);
                }

                // If there is still no value and there are no errors, use the default value if available (no coercion)
                if (isUndefined(this.#processedValue) && isUndefined(this.#error)) {
                    if (schema.type === 'array') {
                        if (schema.items && isArray(schema.items)) {
                            this.#processedValue = reduce(
                                schema.items,
                                (items: any[], item) => {
                                    items.push(item.default);

                                    return items;
                                },
                                []
                            );

                            // If none of the items have a default value reset the processed value to 'undefined'
                            if (every(this.#processedValue, isUndefined)) {
                                this.#processedValue = undefined;
                            }
                        } else {
                            if (!isUndefined(schema.items) && !isUndefined(schema.items.default)) {
                                this.#processedValue = [schema.items.default];
                            }
                        }
                    }

                    // If the processed value is still undefined and if there's a global default set
                    // for the array, we use it
                    if (isUndefined(this.#processedValue) && !isUndefined(schema.default)) {
                        this.#processedValue = schema.default;
                    }
                }
            }

            this.#processed = true;
        }

        return this.#processedValue;
    }

    public get error(): ValueError | undefined  {
        if (this.#valid === true) {
            return undefined;
        } else {
            return this.#error;
        }
    }
    public get errors(): ValueError[] | undefined  {
      if (this.#valid === true) {
          return undefined;
      } else {
          return this.#errors;
      }
  }
}
