import { Path } from "./path";
import { OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import JsonRefs from "json-refs";
import _ from "lodash";
import { Operation } from "./operation";

export class Parameter {
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
}
