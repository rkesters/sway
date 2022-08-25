import debug from "debug";
import _ from "lodash";
import { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

export function isOpenApi31(doc: OpenAPI.Document): doc is OpenAPIV3_1.Document {
  if (!isOpenApi3X(doc)) {
    return false;
  }

  return _.get(doc, "openapi").startsWith("3.1");
}

export function isOpenApi3X(
  doc: OpenAPI.Document
): doc is OpenAPIV3_1.Document | OpenAPIV3.Document {
  if (_.has(doc, "openapi")) {
    return true;
  }

  return false;
}

export function isOpenApi2X(doc: OpenAPI.Document): doc is OpenAPIV2.Document {
  if (_.has(doc, "swagger")) {
    return true;
  }

  return false;
}

export class SwaggerApi {
  definition: OpenAPI.Document;
  definitionRemotesResolved: object;
  definitionFullyResolved: OpenAPI.Document;
  references: object;
  options: object;
  customFormats: object;
  customFormatGenerators: object;

  customValidators: object;
  documentationUrl: string;
  pathObjects: sway.Path[];

  #debug: debug.Debugger;

  get debug():   debug.Debugger {
    return this.#debug
  }

  version: string;

  constructor(
    definition: OpenAPI.Document,
    definitionRemotesResolved,
    definitionFullyResolved,
    references,
    options
  ) {
    debug(
      `Creating SwaggerApi from ${
        _.isString(options.definition)
          ? options.definition
          : "the provided document"
      }`
    );

    this.#debug = debug('sway');

    this.customFormats = {};
    this.customFormatGenerators = {};
    this.customValidators = [];
    this.definition = definition;
    this.definitionFullyResolved = definitionFullyResolved;
    this.definitionRemotesResolved = definitionRemotesResolved;
    this.documentationUrl =
      "https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md";
    this.options = options;
    this.references = references;
    this.version = isOpenApi3X(this.definition)
      ? _.get(this.definition, "openapi")
      : _.get(this.definition, "swagger");
  }


  public get path(): Path {
    return this.definition.paths
  }
}
