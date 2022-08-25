import { SwaggerApi } from "./api";
import { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import _ from "lodash";
import JsonRefs from "json-refs";
import { pathToRegexp } from "path-to-regexp";

export class Path {
  #basePathPrefix: string;
  #sanitizedPath: any;

  #api: SwaggerApi;
  #definition: OpenAPI.Document;
  #definitionFullyResolved: OpenAPI.Document;
  #path: string;
  #pathToDefinition: string;
  #ptr: any;
  #regexp: RegExp;

  #debug:   debug.Debugger;

  parameterObjects: Parameter[];

  constructor(
    api: SwaggerApi,
    path: string,
    definition: OpenAPI.Document,
    definitionFullyResolved,
    pathToDefinition
  ) {
    this.#basePathPrefix = _.get(api.definitionFullyResolved, "basePath", "/");

    if (this.#basePathPrefix.startsWith("/")) {
      this.#basePathPrefix = this.#basePathPrefix.substring(
        0,
        this.#basePathPrefix.length - 1
      );
    }

    this.#sanitizedPath =
      this.#basePathPrefix +
      path
        .replace("(", "\\(") // path-to-regexp
        .replace(")", "\\)") // path-to-regexp
        .replace(":", "\\:") // path-to-regexp
        .replace("*", "\\*") // path-to-regexp
        .replace("+", "\\+") // path-to-regexp
        .replace("?", "\\?") // path-to-regexp
        .replace(/\{/g, ":") // Swagger -> Express-style
        .replace(/\}/g, ""); // Swagger -> Express-style

    // Assign local properties
    this.#api = api;
    this.#definition = definition;
    this.#definitionFullyResolved = definitionFullyResolved;
    this.#path = path;
    this.#pathToDefinition = pathToDefinition;
    this.#ptr = JsonRefs.pathToPtr(pathToDefinition);
    this.#regexp = pathToRegexp(this.#sanitizedPath, undefined, {
      sensitive: true,
    });

    this.#debug = api.debug;
    this.#debug(`    ${this.#path}` );

    this.parameterObjects = _.map(definitionFullyResolved.parameters, function (paramDef, index) {
      var pPath = pathToDefinition.concat(['parameters', index.toString()]);

      return new Parameter(that,
                           _.get(api.definitionRemotesResolved, pPath),
                           paramDef,
                           pPath);
    });
  }

  /**
   * Return the operation for this path and operation id or method.
   *
   * @param {string} idOrMethod - The operation id or method
   *
   * @returns {module:sway.Operation[]} The `Operation` objects for this path and method or `undefined` if there is no
   * operation for the provided method
   */
  public getOperation (idOrMethod: string):Operation[] {
    return _.find(this.#definition. .operationObjects, function (operationObject) {
      return (
        operationObject.operationId === idOrMethod ||
        operationObject.method === idOrMethod.toLowerCase()
      );
    });
  };
}
