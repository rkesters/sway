/**
 * A library for simpler [Swagger](http://swagger.io/) integrations.
 *
 * @module sway
 */

import _ from "lodash";
import { removeCirculars, validateOptionsAllAreFunctions } from "./helpers";
import { CreateOptions } from "./typedefs";
import { SwaggerApi } from "./types/api";
import YAML from "js-yaml";
import JsonRefs from "@rkesters/json-refs";

function validateCreateOptions(options: CreateOptions): void | never {
  if (_.isUndefined(options)) {
    throw new TypeError("options is required");
  } else if (!_.isPlainObject(options)) {
    throw new TypeError("options must be an object");
  } else if (_.isUndefined(options.definition)) {
    throw new TypeError("options.definition is required");
  } else if (
    !_.isPlainObject(options.definition) &&
    !_.isString(options.definition)
  ) {
    throw new TypeError(
      "options.definition must be either an object or a string"
    );
  } else if (
    !_.isUndefined(options.jsonRefs) &&
    !_.isPlainObject(options.jsonRefs)
  ) {
    throw new TypeError("options.jsonRefs must be an object");
  } else if (
    !_.isUndefined(options.customFormats) &&
    !_.isArray(options.customFormats)
  ) {
    throw new TypeError("options.customFormats must be an array");
  } else if (
    !_.isUndefined(options.customFormatGenerators) &&
    !_.isArray(options.customFormatGenerators)
  ) {
    throw new TypeError("options.customFormatGenerators must be an array");
  } else if (
    !_.isUndefined(options.customValidators) &&
    !_.isArray(options.customValidators)
  ) {
    throw new TypeError("options.customValidators must be an array");
  }

  validateOptionsAllAreFunctions(options.customFormats, "customFormats");
  validateOptionsAllAreFunctions(
    options.customFormatGenerators,
    "customFormatGenerators"
  );
  validateOptionsAllAreFunctions(options.customValidators, "customValidators");
}

async function resolveDefintion(cOptions: CreateOptions) {
  // Prepare the json-refs options
  if (_.isUndefined(cOptions.jsonRefs)) {
    cOptions.jsonRefs = {};
  }

  // Include invalid reference information
  cOptions.jsonRefs.includeInvalid = true;

  // Resolve only relative/remote references
  cOptions.jsonRefs.filter = ["relative", "remote"];

  // Update the json-refs options to process YAML
  if (_.isUndefined(cOptions.jsonRefs.loaderOptions)) {
    cOptions.jsonRefs.loaderOptions = {};
  }
  cOptions.jsonRefs.loaderOptions = cOptions.jsonRefs.loaderOptions ?? {};

  if (_.isUndefined(cOptions.jsonRefs.loaderOptions.processContent)) {
    cOptions.jsonRefs.loaderOptions.processContent = function (res, cb) {
      cb(undefined, YAML.safeLoad(res.text));
    };
  }

  // Call the appropriate json-refs API
  if (_.isString(cOptions.definition)) {
    return JsonRefs.resolveRefsAt(cOptions.definition, cOptions.jsonRefs);
  } else {
    return JsonRefs.resolveRefs(cOptions.definition, cOptions.jsonRefs);
  }
}
/**
 * Creates a SwaggerApi object from its Swagger definition(s).
 *
 * @param  options - The options for loading the definition(s)
 *
 * @returns {Promise<module:sway.SwaggerApi>} The promise
 *
 * @example
 * SwaggerApi.create({definition: 'http://petstore.swagger.io/v2/swagger.yaml'})
 *   .then(function (api) {
 *     console.log('Documentation URL: ', api.documentationUrl);
 *   }, function (err) {
 *     console.error(err.stack);
 *   });
 */
export async function create(options: CreateOptions): Promise<SwaggerApi> {
  var cOptions;

  // Validate arguments
  const allTasks = await Promise.all([validateCreateOptions]);

  // Make a copy of the input options so as not to alter them
  cOptions = _.cloneDeep(options);

  //
  allTasks = allTasks
    // Resolve relative/remote references
    .then(function () {})
    // Resolve local references and merge results
    .then(function (remoteResults) {
      // Resolve local references (Remote references should had already been resolved)
      cOptions.jsonRefs.filter = "local";

      return JsonRefs.resolveRefs(
        remoteResults.resolved || cOptions.definition,
        cOptions.jsonRefs
      ).then(function (results) {
        _.each(remoteResults.refs, function (refDetails, refPtr) {
          results.refs[refPtr] = refDetails;
        });

        return {
          // The original Swagger definition
          definition: _.isString(cOptions.definition)
            ? remoteResults.value
            : cOptions.definition,
          // The original Swagger definition with its remote references resolved
          definitionRemotesResolved: remoteResults.resolved,
          // The original Swagger definition with all its references resolved
          definitionFullyResolved: results.resolved,
          // Merge the local reference details with the remote reference details
          refs: results.refs,
        };
      });
    })
    // Process the Swagger document and return the API
    .then(function (results) {
      // We need to remove all circular objects as z-schema does not work with them:
      //   https://github.com/zaggino/z-schema/issues/137
      removeCirculars(results.definition);
      removeCirculars(results.definitionRemotesResolved);
      removeCirculars(results.definitionFullyResolved);

      // Create object model
      return new SwaggerApi(
        results.definition,
        results.definitionRemotesResolved,
        results.definitionFullyResolved,
        results.refs,
        options
      );
    });

  return allTasks;
}
