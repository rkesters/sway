import { OpenAPI, OpenAPIV3_1, OpenAPIV3, OpenAPIV2 } from "openapi-types";
import { SwaggerApi } from "./types/api";
import { Operation } from "./types/operation";
import { SchemaErrorDetail } from "z-schema";
import http from "http";
import { JsonRefsOptions } from "json-refs";
import { Response } from "./types/response";
import cnt from 'connect';


export class  IncomingMessage  extends cnt.IncomingMessage {
  body: any;
  files: any;
}

export type DocumentValidationFunction = (api: SwaggerApi) => ValidationResults;
export type ResponseDef =
  | OpenAPIV3_1.ResponseObject
  | OpenAPIV3.ResponseObject
  | OpenAPIV2.ResponseObject;

export type ResponseValidationFunction = (
  res: ServerResponseWrapper,
  def: Response
) => ValidationResults;

export type RequestValidationFunction  = (
  req: IncomingMessage,
  op: Operation
) => ValidationResults;


export type StrictMode =
  | boolean
  | { formData: boolean; header: boolean; query: boolean };
export interface RequestValidationOptions {
  strictMode: StrictMode;
  customValidators: RequestValidationFunction[];
}



export interface ServerResponseWrapper<BODY = any> {
  body: BODY;
  encoding: string;
  headers:http.OutgoingHttpHeader;
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
