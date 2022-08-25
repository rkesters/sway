import { Path } from "./path";
import JsonRefs from "json-refs";
import { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import _, { isObjectLike, isPlainObject } from "lodash";
import { Parameter } from "./parameter";

function isObject(value:unknown): value is object {
  return isPlainObject (value);
}

export class Operation {

  static isOperation(value:unknown): value is Operation {
    if (!isObject (value)) return false;

    return _.has(value , 'consumes');
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
}
