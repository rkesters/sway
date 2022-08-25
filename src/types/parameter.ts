import { Path } from "./path";
import { OpenAPI , OpenAPIV2, OpenAPIV3 } from "openapi-types";
import JsonRefs from "json-refs";
import _ from "lodash";
import { Operation } from "./operation";
import { getHeaderValue, getSample, parameterLocations } from "../helpers";
import { IncomingMessage } from "../typedefs";

type OpenParameter = OpenAPI.Parameter ;

export class Parameter implements OpenAPIV2.ParameterObject  {
  definition: OpenAPI.Document;
  definitionFullyResolved: OpenAPI.Document;
  pathToDefinition: string[];
  ptr: string;
  operationObject: Operation;
  pathObject: Path;

  constructor(
    opOrPathObject: Operation | Path,
    definition: OpenAPI.Document,
    definitionFullyResolved: OpenAPI.Document,
    pathToDefinition: string[]
  ) {
    // Assign local properties
    this.definition = definition;
    this.definitionFullyResolved = definitionFullyResolved;
    this.pathToDefinition = pathToDefinition;
    this.ptr = JsonRefs.pathToPtr(pathToDefinition);

    if (Operation.isOperation(opOrPathObject)) {
      this.operationObject = opOrPathObject;
      this.pathObject = opOrPathObject.pathObject;
    } else {
      this.operationObject = undefined;
      this.pathObject = opOrPathObject;
    }

    // Assign local properties from the Swagger definition properties
    _.assign(this, definitionFullyResolved);

    if (_.isUndefined(this.schema)) {
      this.schema = helpers.computeParameterSchema(definitionFullyResolved);
    }

    this.pathObject.api._debug(
      "          %s%s (in: %s) at %s",
      _.isUndefined(this.operationObject) ? "" : "  ",
      definitionFullyResolved.name,
      definitionFullyResolved.in,
      this.ptr
    );
  }
  [index: string]: any;
  name: string;
  in: string;
  description?: string;
  required?: boolean;

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
  public getValue(req: IncomingMessage) {
    if (_.isUndefined(req)) {
      throw new TypeError("req is required");
    } else if (!_.isObject(req)) {
      throw new TypeError("req must be an object");
    } else if (parameterLocations.indexOf(this.in) === -1) {
      throw new Error("Invalid 'in' value: " + this.in);
    }

    // We do not need to explicitly check the type of req

    const type = this.schema.type;
    let pathMatch;
    let value;

    switch (this.in) {
      case "body":
        value = req.body;
        break;
      case "formData":
        // For formData, either the value is a file or a property of req.body.  req.body as a whole can never be the
        // value since the JSON Schema for formData parameters does not allow a type of 'object'.
        if (type === "file") {
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
              throw new Error(
                "req.body must be provided for 'formData' parameters"
              );
            } else {
              break;
            }
          }
          value = req.body[this.name];
        }
        break;
      case "header":
        if (_.isUndefined(req.headers)) {
          if (this.required) {
            throw new Error(
              "req.headers must be provided for 'header' parameters"
            );
          } else {
            break;
          }
        }

        value = getHeaderValue(req.headers, this.name);
        break;
      case "path":
        if (_.isUndefined(req.originalUrl) && _.isUndefined(req.url)) {
          throw new Error(
            "req.originalUrl or req.url must be provided for 'path' parameters"
          );
        }

        pathMatch = this.pathObject.regexp.exec(
          parseUrl(req.originalUrl || req.url).pathname
        );

        if (pathMatch) {
          // decode URI component here to avoid issues with encoded slashes
          value = decodeURIComponent(
            pathMatch[
              _.findIndex(this.pathObject.regexp.keys, function (key) {
                return key.name === that.name;
              }) + 1
            ]
          );
        }
        break;
      case "query":
        if (_.isUndefined(req.query)) {
          if (this.required) {
            throw new Error(
              "req.query must be provided for 'query' parameters"
            );
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
