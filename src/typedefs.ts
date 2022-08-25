import { OpenAPI, OpenAPIV3_1, OpenAPIV3, OpenAPIV2 } from "openapi-types";
import { SwaggerApi } from "./types/api";
import { Operation } from "./types/operation";
import { SchemaErrorDetail } from "z-schema";
import { OutgoingHttpHeader, IncomingMessage } from "http";
import { JsonRefsOptions } from "json-refs";

export type DocumentValidationFunction = (api: SwaggerApi) => ValidationResults;
export type ResponseDef =
  | OpenAPIV3_1.ResponseObject
  | OpenAPIV3.ResponseObject
  | OpenAPIV2.ResponseObject;
export type RequestValidationFunction = (
  res: ServerResponseWrapper,
  def: ResponseDef
) => ValidationResults;
export type StrictMode =
  | boolean
  | { formData: boolean; header: boolean; query: boolean };
export interface RequestValidationOptions {
  strictMode: StrictMode;
  customValidators: RequestValidationFunction;
}

type ResponseValidationFunction = (
  req: IncomingMessage,
  op: Operation
) => ValidationResults;

export interface ServerResponseWrapper<BODY = any> {
  body: BODY;
  encoding: string;
  headers: OutgoingHttpHeader;
  statusCode: number | string;
}

/**
 * Validation error/warning object.
 *
 * When this object is created as a result of JSON Schema validation, this object is created by
 * [z-schema](https://github.com/zaggino/z-schema) and it owns the structure so there can be extra properties not
 * documented below.
 */
export type ValidationEntry = SchemaErrorDetail;

/** Validation results object. */
export interface ValidationResults {
  /** The validation errors */
  errors: ValidationEntry[];
  /** warnings - The validation warning */
  warnings: ValidationEntry[];
}

export interface CreateOptions {
  definition: string | OpenAPI.Document;
  jsonRefs: JsonRefsOptions;
  customFormats: Record<string, (value: any) => boolean>;
  customFormatGenerators: Record<string, (generator: any) => any>;
  customValidators: DocumentValidationFunction[];
}
