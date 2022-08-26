import ZSchema from "z-schema";
import * as formatValidators from "./validation/format-validators";
import {
  generators as formatGenerators,
  jsf,
  Faker,
} from "./validation/format-generators";
import * as _ from "lodash";
import { SwaggerApi } from "./types/api";
import { Operation } from "./types/operation";
import {
  ServerResponseWrapper,
  DocumentValidationFunction,
  RequestValidationFunction,
  ValidationResults,
  ResponseValidationFunction,
  StrictMode,
  IncomingMessage,
} from "./typedefs";
import { Response } from "./types/response";
import { Parameter } from "./types/parameter";

export interface Results {
  errors: {
    code: string;
    message: string;
    path: string[];
  }[];
}

// full-date from http://xml2rfc.ietf.org/public/rfc/html/rfc3339.html#anchor14
const dateRegExp = new RegExp(
  "^" +
    "\\d{4}" + // year
    "-" +
    "([0]\\d|1[012])" + // month
    "-" +
    "(0[1-9]|[12]\\d|3[01])" + // day
    "$"
);

// date-time from http://xml2rfc.ietf.org/public/rfc/html/rfc3339.html#anchor14
const dateTimeRegExp = new RegExp(
  "^" +
    "\\d{4}" + // year
    "-" +
    "([0]\\d|1[012])" + // month
    "-" +
    "(0[1-9]|[12]\\d|3[01])" + // day
    "T" +
    "([01]\\d|2[0-3])" + // hour
    ":" +
    "[0-5]\\d" + // minute
    ":" +
    "[0-5]\\d" + // second
    "(\\.\\d+)?" + // fractional seconds
    "(Z|(\\+|-)([01]\\d|2[0-4]):[0-5]\\d)" + // Z or time offset
    "$"
);

const collectionFormats = [undefined, "csv", "multi", "pipes", "ssv", "tsv"];
let jsonMocker;
const jsonSchemaValidator = createJSONValidator();
// https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md#parameter-object
const parameterSchemaProperties = [
  "allowEmptyValue",
  "default",
  "description",
  "enum",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "items",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "multipleOf",
  "pattern",
  "type",
  "uniqueItems",
];
const types = ["array", "boolean", "integer", "object", "number", "string"];

function createJSONMocker(mocker: Faker) {
  // Add the custom format generators
  _.each(formatGenerators, function (gen, name) {
    jsf(name, gen(mocker));
  });

  return mocker;
}

function findExtraParameters(
  expected: string[],
  actual: string[],
  location: string,
  results: ValidationResults
) {
  var codeSuffix = location.toUpperCase();

  switch (location) {
    case "formData":
      codeSuffix = "FORM_DATA";
      location = "form data field";
      break;
    case "query":
      location = "query parameter";
      break;

    // no default
  }

  _.each(actual, function (name) {
    if (expected.indexOf(name) === -1) {
      results.errors.push({
        code: "REQUEST_ADDITIONAL_" + codeSuffix,
        message: "Additional " + location + " not allowed: " + name,
        path: '',
      });
    }
  });
}

/**
 * Registers a custom format.
 *
 * @param {string} name - The name of the format
 * @param {function} validator - The format validator *(See [ZSchema Custom Format](https://github.com/zaggino/z-schema#register-a-custom-format))*
 */
export function registerFormat(
  name: string,
  validator: (value: any) => boolean
) {
  ZSchema.registerFormat(name, validator);
}

/**
 * Registers a custom format generator.
 *
 * @param {string} name - The name of the format
 * @param {function} generator - The format generator *(See [json-schema-mocker Custom Format](https://github.com/json-schema-faker/json-schema-faker#custom-formats))*
 */
export function registerFormatGenerator(name, func) {
  getJSONSchemaMocker().format(name, func);
}
/**
 * Unregisters a custom format.
 *
 * @param {string} name - The name of the format
 */
export function unregisterFormat(name: string) {
  ZSchema.unregisterFormat(name);
}

/**
 * Unregisters a custom format generator.
 *
 * @param {string} name - The name of the format generator
 */
export function unregisterFormatGenerator(name: string) {
  delete getJSONSchemaMocker().format()[name];
}

function createJSONValidator() {
  var validator = new ZSchema({
    breakOnFirstError: false,
    ignoreUnknownFormats: true,
    reportPathAsArray: true,
  });

  // Add the custom validators
  _.each(formatValidators, function (handler, name) {
    registerFormat(name, handler);
  });

  return validator;
}

export function getJSONSchemaMocker() {
  if (!jsonMocker) {
    jsonMocker = createJSONMocker(jsf);
  }

  return jsonMocker;
}

function normalizeError(obj: any) {
  // Remove superfluous error details
  if (_.isUndefined(obj.schemaId)) {
    delete obj.schemaId;
  }

  if (obj.inner) {
    _.each(obj.inner, function (nObj) {
      normalizeError(nObj);
    });
  }
}

/**
 * Helper method to take a Swagger parameter definition and compute its schema.
 *
 * For non-body Swagger parameters, the definition itself is not suitable as a JSON Schema so we must compute it.
 *
 * @param {object} paramDef - The parameter definition
 *
 * @returns {object} The computed schema
 */
export function computeParameterSchema(paramDef: Record<string, any>) {
  var schema;

  if (_.isUndefined(paramDef.schema)) {
    schema = {};

    // Build the schema from the schema-like parameter structure
    _.forEach(parameterSchemaProperties, function (name) {
      if (!_.isUndefined(paramDef[name])) {
        schema[name] = paramDef[name];
      }
    });
  } else {
    schema = paramDef.schema;
  }

  return schema;
}

/**
 * Converts a raw JavaScript value to a JSON Schema value based on its schema.
 *
 * @param {object} schema - The schema for the value
 * @param {object} options - The conversion options
 * @param {string} [options.collectionFormat] - The collection format
 * @param {string} [options.encoding] - The encoding if the raw value is a `Buffer`
 * @param {*} value - The value to convert
 *
 * @returns {*} The converted value
 *
 * @throws {TypeError} IF the `collectionFormat` or `type` is invalid for the `schema`, or if conversion fails
 */
export function convertValue(
  schema,
  options: { collectionFormat: string; encoding: string },
  value: any
) {
  var originalValue = value; // Used in error reporting for invalid values
  var type = _.isPlainObject(schema) ? schema.type : undefined;
  var pValue = value;
  var pType = typeof pValue;
  var err;
  var isDate;
  var isDateTime;

  // If there is an explicit type provided, make sure it's one of the supported ones
  if (_.has(schema, "type") && types.indexOf(type) === -1) {
    throw new TypeError("Invalid 'type' value: " + type);
  }

  // Since JSON Schema allows you to not specify a type and it is treated as a wildcard of sorts, we should not do any
  // coercion for these types of values.
  if (_.isUndefined(type)) {
    return value;
  }

  // If there is no value, do not convert it
  if (_.isUndefined(value)) {
    return value;
  }

  // Convert Buffer value to String
  // (We use this type of check to identify Buffer objects.  The browser does not have a Buffer type and to avoid having
  //  import the browserify buffer module, we just do a simple check.  This is brittle but should work.)
  if (_.isFunction(value.readUInt8)) {
    value = value.toString(options.encoding);
    pValue = value;
    pType = typeof value;
  }

  // If the value is empty and empty is allowed, use it
  if (schema.allowEmptyValue && value === "") {
    return value;
  }

  // Attempt to parse the string as JSON if the type is array or object
  if (["array", "object"].indexOf(type) > -1 && _.isString(value)) {
    if (
      (type === "array" && value.indexOf("[") === 0) ||
      (type === "object" && value.indexOf("{") === 0)
    ) {
      try {
        value = JSON.parse(value);
      } catch (err) {
        // Nothing to do here, just fall through
      }
    }
  }

  switch (type) {
    case "array":
      if (_.isString(value)) {
        if (collectionFormats.indexOf(options.collectionFormat) === -1) {
          throw new TypeError(
            "Invalid 'collectionFormat' value: " + options.collectionFormat
          );
        }

        switch (options.collectionFormat) {
          case "csv":
          case undefined:
            value = value.split(",");
            break;
          case "multi":
            value = [value];
            break;
          case "pipes":
            value = value.split("|");
            break;
          case "ssv":
            value = value.split(" ");
            break;
          case "tsv":
            value = value.split("\t");
            break;

          // no default
        }
      }

      if (_.isArray(value)) {
        value = _.map(value, function (item, index) {
          return convertValue(
            _.isArray(schema.items) ? schema.items[index] : schema.items,
            options,
            item
          );
        });
      }

      break;
    case "boolean":
      if (!_.isBoolean(value)) {
        if (value === "true") {
          value = true;
        } else if (value === "false") {
          value = false;
        } else {
          err = new TypeError("Not a valid boolean: " + value);
        }
      }

      break;
    case "integer":
      if (!_.isNumber(value)) {
        if (_.isString(value) && _.trim(value).length === 0) {
          value = NaN;
        }

        value = Number(value);

        if (_.isNaN(value)) {
          err = new TypeError("Not a valid integer: " + originalValue);
        }
      }

      break;
    case "number":
      if (!_.isNumber(value)) {
        if (_.isString(value) && _.trim(value).length === 0) {
          value = NaN;
        }

        value = Number(value);

        if (_.isNaN(value)) {
          err = new TypeError("Not a valid number: " + originalValue);
        }
      }
      break;
    case "string":
      if (["date", "date-time"].indexOf(schema.format) > -1) {
        if (_.isString(value)) {
          isDate = schema.format === "date" && dateRegExp.test(value);
          isDateTime =
            schema.format === "date-time" && dateTimeRegExp.test(value);

          if (!isDate && !isDateTime) {
            err = new TypeError(
              "Not a valid " + schema.format + " string: " + originalValue
            );
            err.code = "INVALID_FORMAT";
          } else {
            value = new Date(value);
          }
        }

        if (!_.isDate(value) || value.toString() === "Invalid Date") {
          err = new TypeError(
            "Not a valid " + schema.format + " string: " + originalValue
          );

          err.code = "INVALID_FORMAT";
        }
      } else if (!_.isString(value)) {
        err = new TypeError("Not a valid string: " + value);
      }

      break;

    // no default
  }

  if (!_.isUndefined(err)) {
    // Convert the error to be more like a JSON Schema validation error
    if (_.isUndefined(err.code)) {
      err.code = "INVALID_TYPE";
      err.message = "Expected type " + type + " but found type " + pType;
    } else {
      err.message =
        "Object didn't pass validation for format " +
        schema.format +
        ": " +
        pValue;
    }

    // Format and type errors resemble JSON Schema validation errors
    err.failedValidation = true;
    err.path = [];

    throw err;
  }

  return value;
}

/**
 * Returns the provided content type or `application/octet-stream` if one is not provided.
 *
 * @see http://www.w3.org/Protocols/rfc2616/rfc2616-sec7.html#sec7.2.1
 *
 * @param {object} headers - The headers to search
 *
 * @returns {string} The content type
 */
export function getContentType(headers) {
  return getHeaderValue(headers, "content-type") || "application/octet-stream";
}

/**
 * Returns the header value regardless of the case of the provided/requested header name.
 *
 * @param {object} headers - The headers to search
 * @param {string} headerName - The header name
 *
 * @returns {string} The header value or `undefined` if it is not found
 */
export function getHeaderValue(headers, headerName) {
  // Default to an empty object
  headers = headers || {};

  var lcHeaderName = headerName.toLowerCase();
  var realHeaderName = _.find(Object.keys(headers), function (header) {
    return header.toLowerCase() === lcHeaderName;
  });

  return headers[realHeaderName];
}

/**
 * Returns a json-schema-faker mocker.
 *
 * @returns {object} The json-schema-faker mocker to use
 */

export function getSample(schema) {
  var sample;

  if (!_.isUndefined(schema)) {
    if (schema.type === "file") {
      sample = 'This is sample content for the "file" type.';
    } else {
      sample = getJSONSchemaMocker().generate(schema);
    }
  }

  return sample;
}

/**
 * Returns a z-schema validator.
 *
 * @returns {object} The z-schema validator to use
 */
export function getJSONSchemaValidator() {
  return jsonSchemaValidator;
}

export const parameterLocations = [
  "body",
  "formData",
  "header",
  "path",
  "query",
];

function processDocumentValidators(
  _target: any,
  caller: SwaggerApi,
  validators: DocumentValidationFunction[]
) {
  validators.reduce(
    (acc, validator: DocumentValidationFunction) => {
      const results = validator(caller);
      if (!results) {
        return acc;
      }
      return mergeValidationResults(acc, results);
    },
    { errors: [], warnings: [] } as ValidationResults
  );
}

function processRequestValidators(
  target: IncomingMessage,
  caller: Operation,
  validators: RequestValidationFunction[]
) {
  validators.reduce(
    (acc, validator: RequestValidationFunction) => {
      const results = validator(target, caller);
      if (!results) {
        return acc;
      }
      return mergeValidationResults(acc, results);
    },
    { errors: [], warnings: [] } as ValidationResults
  );
}
function processResponseValidators(
  target: ServerResponseWrapper,
  caller: Response,
  validators: ResponseValidationFunction[]
) {
  validators.reduce(
    (acc, validator: ResponseValidationFunction) => {
      const results = validator(target, caller);
      if (!results) {
        return acc;
      }
      return mergeValidationResults(acc, results);
    },
    { errors: [], warnings: [] } as ValidationResults
  );
}

function mergeValidationResults(that, results): ValidationResults {
  if (!_.isEmpty(results.errors)) {
    that.errors = [...that.errors, ...results.errors];
  }

  if (!_.isEmpty(results.warnings)) {
    that.warnings = [...that.warnings, ...results.warnings];
  }
  return that;
}

/**
 * Process validators.
 *
 * @param target - The thing being validated
 * @param caller - The object requesting validation _(can be `undefined`)_
 * @param validators - The validators
 * @param results - The cumulative validation results
 */
export function processValidators(
  target: undefined,
  caller: SwaggerApi,
  validators: DocumentValidationFunction[],
  results: ValidationResults
);
export function processValidators(
  target: ServerResponseWrapper,
  caller: Response,
  validators: ResponseValidationFunction[],
  results: ValidationResults
);
export function processValidators(
  target: IncomingMessage,
  caller: Operation,
  validators: RequestValidationFunction[],
  results: ValidationResults
);
export function processValidators(
  target: ServerResponseWrapper | IncomingMessage | undefined,
  caller: SwaggerApi | Operation | Response,
  validators:
    | DocumentValidationFunction[]
    | RequestValidationFunction[]
    | ResponseValidationFunction[],
  results: ValidationResults
) {
  if (SwaggerApi.isa(caller)) {
    const out = processDocumentValidators(
      undefined,
      caller,
      validators as DocumentValidationFunction[]
    );
    return mergeValidationResults(results, out);
  }

  if (Operation.isOperation(caller)) {
    const out = processRequestValidators(
      target as IncomingMessage ,
      caller,
      validators as RequestValidationFunction[]
    );
    return mergeValidationResults(results, out);
  }

  const out = processResponseValidators(
    target as ServerResponseWrapper,
    caller,
    validators as ResponseValidationFunction[]
  );
  return mergeValidationResults(results, out);
}

/**
 * Replaces the circular references in the provided object with an empty object.
 *
 * @param {object} obj - The JavaScript object
 */
export function removeCirculars(obj) {
  walk(obj, function (node, path, ancestors) {
    // Replace circulars with {}
    if (ancestors.indexOf(node) > -1) {
      _.set(obj, path, {});
    }
  });
}

/**
 * Validates the provided value against the JSON Schema by name or value.
 *
 * @param {object} validator - The JSON Schema validator created via {@link #createJSONValidator}
 * @param {object} schema - The JSON Schema
 * @param {*} value - The value to validate
 *
 * @returns {object} Object containing the errors and warnings of the validation
 */
export function validateAgainstSchema(validator, schema, value) {
  schema = _.cloneDeep(schema); // Clone the schema as z-schema alters the provided document

  var response = {
    errors: [],
    warnings: [],
  };

  if (!validator.validate(value, schema)) {
    response.errors = _.map(validator.getLastErrors(), function (err) {
      normalizeError(err);

      return err;
    });
  }

  return response;
}

/**
 * Validates the content type.
 *
 * @param {string} contentType - The Content-Type value of the request/response
 * @param {string[]} supportedTypes - The supported (declared) Content-Type values for the request/response
 * @param {object} results - The results object to update in the event of an invalid content type
 */
export function validateContentType(contentType, supportedTypes, results) {
  var rawContentType = contentType;

  if (!_.isUndefined(contentType)) {
    // http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.17
    contentType = contentType.split(";")[0]; // Strip the parameter(s) from the content type
  }

  // Check for exact match or mime-type only match
  if (
    _.indexOf(supportedTypes, rawContentType) === -1 &&
    _.indexOf(supportedTypes, contentType) === -1
  ) {
    results.errors.push({
      code: "INVALID_CONTENT_TYPE",
      message:
        "Invalid Content-Type (" +
        contentType +
        ").  These are supported: " +
        supportedTypes.join(", "),
      path: [],
    });
  }
}

/**
 * Walk an object and invoke the provided function for each node.
 *
 * @param {*} obj - The object to walk
 * @param {function} [fn] - The function to invoke
 */
export function walk(obj: any, fn: Function) {
  var callFn = _.isFunction(fn);

  function doWalk(ancestors, node, path) {
    if (callFn) {
      fn(node, path, ancestors);
    }

    // We do not process circular objects again
    if (ancestors.indexOf(node) === -1) {
      ancestors.push(node);

      if (_.isArray(node) || _.isPlainObject(node)) {
        _.each(node, function (member, indexOrKey) {
          doWalk(ancestors, member, path.concat(indexOrKey.toString()));
        });
      }
    }

    ancestors.pop();
  }

  doWalk([], obj, []);
}

/**
 * Validates that each item in the array are of type function.
 *
 * @param {array} arr - The array
 * @param {string} paramName - The parameter name
 */
export function validateOptionsAllAreFunctions(arr: any[], paramName: string) {
  _.forEach(arr, function (item, index) {
    if (!_.isFunction(item)) {
      throw new TypeError(
        "options." + paramName + " at index " + index + " must be a function"
      );
    }
  });
}

/**
 * Validates the request/response strictly based on the provided options.
 *
 * @param {module:Sway~Operation|module:Sway~Response} opOrRes - The Sway operation or response
 * @param {object|module:Sway~ServerResponseWrapper} reqOrRes - The http client request *(or equivalent)* or the
 *                                                              response or *(response like object)*
 * @param {object} strictMode - The options for configuring strict mode
 * @param {boolean} options.formData - Whether or not form data parameters should be validated strictly
 * @param {boolean} options.header - Whether or not header parameters should be validated strictly
 * @param {boolean} options.query - Whether or not query parameters should be validated strictly
 * @param {module:Sway~ValidationResults} results - The validation results
 */
export function validateStrictMode(
  opOrRes: Operation | Response,
  reqOrRes: ServerResponseWrapper | IncomingMessage ,
  strictMode: StrictMode | undefined,
  results: ValidationResults
) {
  var definedParameters = {
    formData: [],
    header: [],
    query: [],
  };
  var mode = opOrRes.constructor.name === "Operation" ? "req" : "res";
  var strictModeValidation = {
    formData: false,
    header: false,
    query: false,
  };

  if (!_.isUndefined(strictMode)) {
    if (!_.isBoolean(strictMode) && !_.isPlainObject(strictMode)) {
      throw new TypeError("options.strictMode must be a boolean or an object");
    }

    if (!_.isBoolean(strictMode) ) {
      _.each(["formData", "header", "query"], function (location) {
        if (!_.isUndefined(strictMode[location])) {
          if (!_.isBoolean(strictMode[location])) {
            throw new TypeError(
              "options.strictMode." + location + " must be a boolean"
            );
          } else {
            strictModeValidation[location] = strictMode[location];
          }
        }
      });
    } else if (strictMode === true) {
      strictModeValidation.formData = true;
      strictModeValidation.header = true;
      strictModeValidation.query = true;
    }
  }

  // Only process the parameters if necessary
  if (
    strictModeValidation.formData === true ||
    strictModeValidation.header === true ||
    strictModeValidation.query === true
  ) {
    _.each(
      (Operation.isOperation(opOrRes) ? opOrRes : opOrRes.operationObject).getParameters(),
      function (parameter: Parameter) {
        if (_.isArray(definedParameters[parameter.in])) {
          definedParameters[parameter.in].push(parameter.name);
        }
      }
    );
  }

  // Validating form data only matters for requests
  if (strictModeValidation.formData === true && mode === "req") {
    findExtraParameters(
      definedParameters.formData,
      _.isPlainObject(reqOrRes.body) ? Object.keys(reqOrRes.body) : [],
      "formData",
      results
    );
  }

  // Always validate the headers for requests and responses
  if (strictModeValidation.header === true) {
    findExtraParameters(
      definedParameters.header,
      _.isPlainObject(reqOrRes.headers) ? Object.keys(reqOrRes.headers) : [],
      "header",
      results
    );
  }

  // Validating the query string only matters for requests
  if (strictModeValidation.query === true && mode === "req") {
    findExtraParameters(
      definedParameters.query,
      _.isPlainObject(reqOrRes.query) ? Object.keys(reqOrRes.query) : [],
      "query",
      results
    );
  }
}
