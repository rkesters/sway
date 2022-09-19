/**
 * A library for simpler [Swagger](http://swagger.io/) integrations.
 *
 * @module sway
 */

import _ from "lodash";
import { removeCirculars, validateOptionsAllAreFunctions } from "./helpers";
import { CreateOptions } from "./typedefs";
import { SwaggerApi } from "./types/v2/api";
import YAML from "js-yaml";
import JsonRefs, {
  GeneralDocument,
  JsonRefsOptions,
  ResolvedRefDetails,
} from "@rkesters/json-refs";
import {
  isLoadOptions,
  LoadOptions,
  LoadOptionsBase,
  ProcessResponseCallback,
} from "@rkesters/path-loader";
import { OpenAPI, OpenAPIV3_1, OpenAPIV3, OpenAPIV2 } from "openapi-types";

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

function addDefaultProcessContent(
  opts: LoadOptionsBase
): LoadOptions<OpenAPI.Document> {
  (opts as LoadOptions<OpenAPI.Document>).processContent = <
    ProcessResponseCallback<OpenAPI.Document>
  >function (res, cb) {
    cb(undefined, YAML.load(res.text) as OpenAPI.Document);
  };
  return opts as LoadOptions<OpenAPI.Document>;
}
async function resolveDefintion(
  cOptions: CreateOptions
): Promise<
  | JsonRefs.ResolvedRefsResults
  | JsonRefs.RetrievedResolvedRefsResults
> {
  // Prepare the json-refs options
  if (_.isUndefined(cOptions.jsonRefs)) {
    cOptions.jsonRefs = {} as JsonRefsOptions;
  }

  // Include invalid reference information
  cOptions.jsonRefs.includeInvalid = true;

  // Resolve only relative/remote references
  cOptions.jsonRefs.filter = ["relative", "remote"];

  // Update the json-refs options to process YAML
  cOptions.jsonRefs.loaderOptions = isLoadOptions(
    cOptions.jsonRefs.loaderOptions
  )
    ? cOptions.jsonRefs.loaderOptions
    : addDefaultProcessContent(cOptions.jsonRefs.loaderOptions);

  // Call the appropriate json-refs API
  if (_.isString(cOptions.definition)) {
    return JsonRefs.resolveRefsAt(
      cOptions.definition,
      cOptions.jsonRefs
    );
  } else {
    return JsonRefs.resolveRefs(cOptions.definition as unknown as GeneralDocument, cOptions.jsonRefs);
  }
}

async function resolveLocal(
  cOptions: CreateOptions,
  remoteResults:
    | JsonRefs.RetrievedResolvedRefsResults
    | JsonRefs.ResolvedRefsResults
): Promise<ResolveLocalResults> {
  // Resolve local references (Remote references should had already been resolved)
  cOptions.jsonRefs.filter = "local";

  return JsonRefs.resolveRefs(
    (remoteResults as JsonRefs.RetrievedResolvedRefsResults).value ?? (cOptions.definition as unknown as GeneralDocument),
    cOptions.jsonRefs
  ).then(function (results) {
    _.each(
      remoteResults.refs,
      function (refDetails: ResolvedRefDetails, refPtr) {
        results.refs[refPtr] = refDetails;
      }
    );

    return {
      // The original Swagger definition
      definition: (_.isString(cOptions.definition)
        ? (remoteResults as JsonRefs.RetrievedResolvedRefsResults).value
        : cOptions.definition) as OpenAPI.Document,
      // The original Swagger definition with its remote references resolved
      definitionRemotesResolved: remoteResults.resolved,
      // The original Swagger definition with all its references resolved
      definitionFullyResolved: results.resolved,
      // Merge the local reference details with the remote reference details
      refs: results.refs,
    };
  });
}

export interface ResolveLocalResults {
  // The original Swagger definition
  definition: OpenAPI.Document;
  // The original Swagger definition with its remote references resolved
  definitionRemotesResolved: Record<string, JsonRefs.ResolvedRefDetails>;
  // The original Swagger definition with all its references resolved
  definitionFullyResolved: Record<string, JsonRefs.ResolvedRefDetails>;
  // Merge the local reference details with the remote reference details
  refs: Record<string, JsonRefs.UnresolvedRefDetails>;
};

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
  let allTasks: Promise<any> = Promise.resolve();

  validateCreateOptions(options);

  // Make a copy of the input options so as not to alter them
  cOptions = _.cloneDeep(options);

  //
  allTasks = allTasks
    // Resolve relative/remote references
    .then(function () {
      return resolveDefintion(cOptions);
    })
    // Resolve local references and merge results
    .then(function (remoteResults) {
      // Resolve local references (Remote references should had already been resolved)
      return resolveLocal(cOptions, remoteResults);
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
