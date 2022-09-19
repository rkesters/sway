import { OpenAPI, OpenAPIV3_1, OpenAPIV3, OpenAPIV2 } from "openapi-types";
import { SwaggerApi } from "./types/v2/api";
import { Operation } from "./types/v2/operation";
import { SchemaErrorDetail } from "z-schema";
import http from "http";
import { JsonRefsOptions } from "@rkesters/json-refs";
import { Response } from "./types/response";
import cnt from 'connect';
import { has, isError } from "lodash";
import { DocumentApi, OperationApi, ResponseApi } from "./types/typedefs";

export type Modify<T, R> = Omit<T, keyof R> & R;

export interface  IncomingMessage  extends cnt.IncomingMessage {
  body: any;
  files: any;
  query: string;
  headers: Record<string,any>
}

/**
 * Function used for custom validation of Swagger documents
 *
 * @typedef {function} DocumentValidationFunction
 *
 * @param {module:sway.SwaggerApi} api - The Swagger API object
 *
 * @returns {module:sway.ValidationResults} The validation results
 *
 * @memberof module:sway
 */
export type DocumentValidationFunction = (api: DocumentApi.Document) => ValidationResults;


/**
 * Response validation function.
 *
 * @typedef {function} ResponseValidationFunction
 *
 * @param {object} req - The http client request *(or equivalent)*
 * @param {module:sway.Operation} op - The `Operation` object for the request
 *
 * @returns {module:sway.ValidationResults} The validation results
 *
 * @memberof module:sway
 */
export type ResponseValidationFunction = (
  res: ServerResponseWrapper,
  def: ResponseApi.ResponseObject
) => ValidationResults;

/**
 * Request validation function.
 *
 * @typedef {function} RequestValidationFunction
 *
 * @param {module:sway.ServerResponseWrapper} res - The response or response like object
 * @param {module:sway.Response} def - The `Response` definition _(useful primarily when calling
 * `Operation#validateResponse` as `Response#validateResponse` the caller should have access to the `Response` object
 * already.)_
 *
 * @returns {module:sway.ValidationResults} The validation results
 *
 * @memberof module:sway
 */
export type RequestValidationFunction  = (
  req: IncomingMessage,
  op: OperationApi.OperationObject
) => ValidationResults;

export type StrictModeObject = { formData: boolean; header: boolean; query: boolean };
export type StrictMode =
  | boolean
  | StrictModeObject;

/**
 * Request validation options.
 *
 * @typedef {object} RequestValidationOptions
 *
 * @property {boolean|object} [strictMode=false] - Enablement of strict mode validation.  If `strictMode` is a
 * `boolean` and is `true`, all form fields, headers and query parameters **must** be defined in the Swagger document
 * for this operation.  If `strictMode` is an `object`, the keys correspond to the `in` property values of the
 * [Swagger Parameter Object](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#parameterObject)
 * and its value is a `boolean` that when `true` turns on strict mode validation for the request location matching the
 * key.  Valid keys are `formData`, `header` and `query`.  _(`body` and `path` are not necessary since `body` strict
 * mode is possible via its schema and `path` is **always** required.)_
 * @property {module:sway.RequestValidationFunction} [customValidators] - The custom validators
 *
 * @memberof module:sway
 */
export interface RequestValidationOptions {
  strictMode: StrictMode;
  customValidators: RequestValidationFunction[];
}


/**
 * Server response wrapper.
 *
 * Since the low level `http.ServerResponse` object is not always guaranteed and even if it is, there is no public way
 * to gather the necessary parts of the response to perform validation, this object encapsulates the required response
 * information to perform response validation.
 *
 * @typedef {object} ServerResponseWrapper
 *
 * @property {*} body - The response body
 * @property {string} [encoding] - The encoding of the body when the body is a `Buffer`
 * @property {object} [headers] - The response headers
 * @property {number|string} [statusCode=default] - The response status code
 *
 * @memberof module:sway
 */
export interface ServerResponseWrapper<BODY = any> {
  body: BODY;
  encoding: string;
  headers:http.OutgoingHttpHeaders;
  statusCode: number | string;
  query: string;
}

/**
 * Validation error/warning object.
 *
 * When this object is created as a result of JSON Schema validation, this object is created by
 * [z-schema](https://github.com/zaggino/z-schema) and it owns the structure so there can be extra properties not
 * documented below.
 *
 * @typedef {object} ValidationEntry
 *
 * @property {string} code - The code used to identify the error/warning
 * @property {string} [error] - Whenever there is an upstream `Error` encountered, its message is here
 * @property {module:sway.ValidationEntry[]} [errors] - The nested error(s) encountered during validation
 * @property {string[]} [lineage] - Contains the composition lineage for circular composition errors
 * @property {string} message - The human readable description of the error/warning
 * @property {string} [name] - The header name for header validation errors
 * @property {array} [params] - The parameters used when validation failed *(This is a z-schema construct and is only
 * set for JSON Schema validation errors.)*
 * @property {string[]} path - The path to the location in the document where the error/warning occurred
 * @property {string} [schemaId] - The schema id *(This is a z-schema construct and is only set for JSON Schema
 * validation errors and when its value is not `undefined`.)
 *
 * @memberof module:sway
 */
export type ValidationEntry = Modify<Partial<SchemaErrorDetail>, {
  errors?: ValidationEntry[];
  lineage?: string[]
  name?: string;
  path?: string[];
  schemaId?: string;
  message: string
}> ;

export function isValidationEntry(value: unknown): value is ValidationEntry {
  return has(value, 'message');
}

/**
 * Validation results object.
 *
 * @typedef {object} ValidationResults
 *
 * @property {module:sway.ValidationEntry[]} errors - The validation errors
 * @property {module:sway.ValidationEntry[]} warnings - The validation warnings
 *
 * @memberof module:sway
 */
export interface ValidationResults {
  /** The validation errors */
  errors: ValidationEntry[];
  /** warnings - The validation warning */
  warnings: ValidationEntry[];
}
export interface ValidationSchemaResults {
  /** The validation errors */
  errors: SchemaErrorDetail[];
  /** warnings - The validation warning */
  warnings: SchemaErrorDetail[];
}


/**
 * Options used when creating the `SwaggerApi`.
 *
 * @typedef  CreateOptions
 *
 * @property {object|string} definition - The Swagger definition location or structure
 * @property {object} [jsonRefs] - *(See [JsonRefs~JsonRefsOptions](https://github.com/whitlockjc/json-refs/blob/master/docs/API.md#module_JsonRefs..JsonRefsOptions))*
 * @property {object} [customFormats] - The key/value pair of custom formats *(The keys are the format name and the
 * values are async functions.  See [ZSchema Custom Formats](https://github.com/zaggino/z-schema#register-a-custom-format))*
 * @property {object} [customFormatGenerators] - The key/value pair of custom format generators *(The keys are the
 * format name and the values are functions.  See [json-schema-mocker Custom Format](https://github.com/json-schema-faker/json-schema-faker#custom-formats))*
 * @property {module:sway.DocumentValidationFunction[]} [customValidators] - The custom validators
 *
 * @memberof module:sway
 */
export interface CreateOptions {
  definition: string | OpenAPI.Document;
  jsonRefs?: JsonRefsOptions;
  customFormats?: Record<string, (value: any) => boolean>;
  customFormatGenerators?: Record<string, (generator: any) => any>;
  customValidators?: DocumentValidationFunction[];
}

/**
 * Response validation options.
 *
 * @typedef {object} ResponseValidationOptions
 *
 * @property {boolean|object} [strictMode=false] - Enablement of strict mode validation.  If `strictMode` is a
 * `boolean` and is `true`, all form fields, headers and query parameters **must** be defined in the Swagger document
 * for this operation.  If `strictMode` is an `object`, the keys correspond to the `in` property values of the
 * [Swagger Parameter Object](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#parameterObject)
 * and its value is a `boolean` that when `true` turns on strict mode validation for the request location matching the
 * key.  Valid keys are `header`.  _(`body`, `query` and `path` are not necessary since `body` strict mode is possible
 * via its schema and `path`, `query` do not matter for responses.)_
 * @property {module:sway.RequestValidationFunction} [customValidators] - The custom validators
 *
 * @memberof module:sway
 */

export interface ResponseValidationOptions {
  strictMode?: StrictMode;
  customValidators?: RequestValidationFunction[];
}
