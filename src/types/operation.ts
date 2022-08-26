import { Path } from "./path";
import JsonRefs from "@rkesters/json-refs";
import { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import _, { isObjectLike, isPlainObject } from "lodash";
import { Parameter } from "./parameter";
import { Response } from "./response";
import { IncomingMessage } from "http";
import { RequestValidationOptions, ValidationResults } from "../typedefs";
import { getContentType, processValidators, validateContentType, validateOptionsAllAreFunctions, validateStrictMode } from "../helpers";

function isObject(value: unknown): value is object {
  return isPlainObject(value);
}

export class Operation implements OpenAPIV3.OperationObject {


  static isOperation(value: unknown): value is Operation {
    if (!isObject(value)) return false;

    return _.has(value, "consumes") || value instanceof Operation;
  }
  consumes: any;
  definition: OpenAPI.Document;
  definitionFullyResolved: OpenAPI.Document;
  method: string;
  parameterObjects: any[];
  pathToDefinition: string[];
  produces: any;
  ptr: string;
  pathObject: Path;
  responseObjects: Response[];
  securityDefinitions: any;
  security: any;

  tags: string[];

  #debug: debug.Debugger;
  #seenParameters: string[] = [];
  constructor(
    pathObject: Path,
    method: string,
    definition: OpenAPI.Document,
    definitionFullyResolved,
    pathToDefinition: string[]
  ) {
    this.consumes =
      definitionFullyResolved.consumes || pathObject.api.consumes || [];
    this.definition = _.cloneDeep(definition); // Clone so we do not alter the original
    this.definitionFullyResolved = _.cloneDeep(definitionFullyResolved); // Clone so we do not alter the original
    this.method = method;
    this.parameterObjects = []; // Computed below
    this.pathObject = pathObject;
    this.pathToDefinition = pathToDefinition;
    this.produces =
      definitionFullyResolved.produces || pathObject.api.produces || [];
    this.ptr = JsonRefs.pathToPtr(pathToDefinition);

    // Add the Parameter objects from the Path object that were not redefined in the operation definition
    this.parameterObjects = _.map(
      pathObject.parameterObjects,
      function (parameterObject) {
        this.#seenParameters.push(
          `${parameterObject.in}:${parameterObject.name}`
        );

        return parameterObject;
      }
    );

    _.each(definitionFullyResolved.parameters, function (paramDef, index) {
      const key = paramDef.in + ":" + paramDef.name;
      const seenIndex = this.#seenParameters.indexOf(key);
      const pPath = pathToDefinition.concat(["parameters", index.toString()]);
      const parameterObject = new Parameter(
        this,
        _.get(pathObject.api.definitionRemotesResolved, pPath),
        paramDef,
        pPath
      );

      if (seenIndex > -1) {
        this.parameterObjects[seenIndex] = parameterObject;
      } else {
        this.parameterObjects.push(parameterObject);

        this.#seenParameters.push(key);
      }
    });

    this.responseObjects = _.map(
      this.definitionFullyResolved.responses,
      function (responseDef, code) {
        var rPath = pathToDefinition.concat(["responses", code]);

        return new Response(
          this,
          code,
          _.get(this.pathObject.api.definitionRemotesResolved, rPath),
          responseDef,
          rPath
        );
      }
    );
    // Override global security with locally defined
    const security =
      this.security || pathObject.api.definitionFullyResolved.security;

    this.securityDefinitions = _.reduce(
      security,
      function (defs, reqs) {
        _.each(reqs, function (req, name) {
          const def = pathObject.api.definitionFullyResolved.securityDefinitions
            ? pathObject.api.definitionFullyResolved.securityDefinitions[name]
            : undefined;

          if (!_.isUndefined(def)) {
            defs[name] = def;
          }

          this.#debug(
            "            %s (type: %s)",
            name,
            _.isUndefined(def) ? "missing" : def.type
          );
        });

        return defs;
      },
      {}
    );
  }

  /**
   * Returns the parameter with the provided name and location when provided.
   *
   * @param   name - The name of the parameter
   * @param   [location] - The location *(`in`)* of the parameter *(Used for disambiguation)*
   *
   * @returns {module:sway.Parameter} The `Parameter` matching the location and name combination or `undefined` if there
   * is no match
   */
  public getParameter(name: string, location: string): Parameter {
    return _.find(this.parameterObjects, function (parameterObject) {
      return (
        parameterObject.name === name &&
        (_.isUndefined(location) ? true : parameterObject.in === location)
      );
    });
  }

  /**
   * Returns all parameters for the operation.
   *
   * @returns All `Parameter` objects for the operation
   */
  public getParameters(): Parameter[] {
    return this.parameterObjects;
  }

  /**
   * Returns the response for the requested status code or the default response *(if available)* if none is provided.
   *
   * @param  [statusCode='default'] - The status code
   *
   * @returns {module:sway.Response} The `Response` or `undefined` if one cannot be found
   */
  getResponse(statusCode: number | string = "default"): Response {
    if (_.isUndefined(statusCode)) {
      statusCode = "default";
    } else if (_.isNumber(statusCode)) {
      statusCode = statusCode.toString();
    }

    return _.find(this.getResponses(), function (responseObject) {
      return responseObject.statusCode === statusCode;
    });
  }

  /**
   * Returns all responses for the operation.
   *
   * @returns   All `Response` objects for the operation
   */
  getResponses(): Response[] {
    return this.responseObjects;
  }

  /**
   * Returns the composite security definitions for this operation.
   *
   * The difference between this API and `this.security` is that `this.security` is the raw `security` value for the
   * operation where as this API will return the global `security` value when available and this operation's security
   * is undefined.
   *
   * @returns   The security for this operation
   */
  getSecurity():
    | OpenAPIV2.SecurityRequirementObject[]
    | OpenAPIV3.SecurityRequirementObject[] {
    return (
      this.definitionFullyResolved.security ??
      this.pathObject.api.definitionFullyResolved.security
    );
  }
  /**
 * Validates the request.
 *
 * **Note:** Below is the list of `req` properties used *(req should be an `http.ClientRequest` or equivalent)*:
 *
 *   * `body`: Used for `body` and `formData` parameters
 *   * `files`: Used for `formData` parameters whose `type` is `file`
 *   * `headers`: Used for `header` parameters and consumes
 *   * `originalUrl`: used for `path` parameters
 *   * `query`: Used for `query` parameters
 *   * `url`: used for `path` parameters
 *
 * For `path` parameters, we will use the operation's `regexp` property to parse out path parameters using the
 * `originalUrl` or `url` property.
 *
 * *(See: {@link https://nodejs.org/api/http.html#http_class_http_clientrequest})*
 *
 * @param  req - The http client request *(or equivalent)*
 * @param  [options] - The validation options
 *
 * @returns  The validation results
 */
validateRequest  (req: IncomingMessage, options?: Partial<RequestValidationOptions>): ValidationResults {
  var results: ValidationResults = {
    errors: [],
    warnings: []
  };

  if (_.isUndefined(req)) {
    throw new TypeError('req is required');
  } else if (!_.isObject(req)) {
    throw new TypeError('req must be an object');
  } else if (!_.isUndefined(options) && !_.isPlainObject(options)) {
    throw new TypeError('options must be an object');
  } else if (!_.isUndefined(options) && !_.isUndefined(options.customValidators)) {
     if (!_.isArray(options.customValidators)) {
      throw new TypeError('options.customValidators must be an array');
     }

     validateOptionsAllAreFunctions(options.customValidators, 'customValidators');
  }

    options = options ?? {};

  // Validate the Content-Type if there is a set of expected consumes and there is a body
  if (this.consumes.length > 0 && !_.isUndefined(req.body)) {
    validateContentType(getContentType(req.headers), this.consumes, results);
  }

  // Validate the parameters
  _.each(this.getParameters(), function (param) {
    var paramValue = param.getValue(req);
    var vErr;

    if (!paramValue.valid) {
      vErr = {
        code: 'INVALID_REQUEST_PARAMETER',
        errors: paramValue.error.errors || [
          {
            code: paramValue.error.code,
            message: paramValue.error.message,
            path: paramValue.error.path
          }
        ],
        in: paramValue.parameterObject.in,
        // Report the actual error if there is only one error.  Otherwise, report a JSON Schema validation error.
        message: 'Invalid parameter (' + param.name + '): ' + ((paramValue.errors || []).length > 1 ?
                                                               'Value failed JSON Schema validation' :
                                                               paramValue.error.message),
        name: paramValue.parameterObject.name,
        path: paramValue.error.path
      };

      results.errors.push(vErr);
    }
  });

  // Validate strict mode
  validateStrictMode(this, req, options.strictMode, results);

  // Process custom validators
  processValidators(req, this, options.customValidators, results);

  return results;
};
}
