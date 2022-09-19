import _, { isBoolean } from 'lodash';
import { ServerResponseWrapper, StrictMode, ValidationResults } from '../../typedefs';
import { Operation } from './operation';
import { Parameter } from './parameter';

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
    reqOrRes: ServerResponseWrapper,
    strictMode: StrictMode | undefined,
    results: ValidationResults
) {
    const definedParameters = {
        formData: [],
        header: [],
        query: [],
    };
    const mode = Operation.isOperation(opOrRes) ? 'req' : 'res';
    const defaultMode = {
        formData: false,
        header: false,
        query: false,
    };
    if (!_.isUndefined(strictMode)) {
        if (!_.isBoolean(strictMode) && !_.isPlainObject(strictMode)) {
            throw new TypeError('options.strictMode must be a boolean or an object');
        }
    }
    const strictModeValidation: Record<'formData' | 'header' | 'query', boolean> = isBoolean(
        strictMode
    )
        ? strictMode === true
            ? {
                  formData: true,
                  header: true,
                  query: true,
              }
            : defaultMode
        : { ...defaultMode, ...strictMode };

    const strictModeValidationKeys: (keyof typeof strictModeValidation)[] = [
        'formData',
        'header',
        'query',
    ];

    _.each(strictModeValidationKeys, function (location:(keyof typeof strictModeValidation)) {
        if (!_.isUndefined(strictModeValidation[location])) {
            if (!_.isBoolean(strictModeValidation[location])) {
                throw new TypeError('options.strictMode.' + location + ' must be a boolean');
            } 
        }
    });

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
    if (strictModeValidation.formData === true && mode === 'req') {
        findExtraParameters(
            definedParameters.formData,
            _.isPlainObject(reqOrRes.body) ? Object.keys(reqOrRes.body) : [],
            'formData',
            results
        );
    }

    // Always validate the headers for requests and responses
    if (strictModeValidation.header === true) {
        findExtraParameters(
            definedParameters.header,
            _.isPlainObject(reqOrRes.headers) ? Object.keys(reqOrRes.headers) : [],
            'header',
            results
        );
    }

    // Validating the query string only matters for requests
    if (strictModeValidation.query === true && mode === 'req') {
        findExtraParameters(
            definedParameters.query,
            _.isPlainObject(reqOrRes.query) ? Object.keys(reqOrRes.query) : [],
            'query',
            results
        );
    }
}
