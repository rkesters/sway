import debug from 'debug';
import { Path } from './path';
import { DocumentApi, OperationApi, ParameterApi, PathApi, SecurityApi, ValueError } from './typedefs';

export interface ISwaggerApi<
    D extends DocumentApi.resolved.Document,
    P extends PathApi.PathItemObject,
    R extends PathApi.resolved.PathItemObject,
    O extends OperationApi.OperationObject,
    OR extends OperationApi.resolved.OperationObject,
    Pa extends ParameterApi.ParameterObject,
    RPa extends ParameterApi.resolved.ParameterObject,
    S extends SecurityApi.SecurityRequirementObject
> {
    readonly debug: debug.Debugger;
    readonly definitionFullyResolved: D;
    readonly definitionRemotesResolved: D;
    readonly produces: string[] | undefined;
    readonly consumes: string[] | undefined;
    readonly path: Record<string, Path<D, P, R,O,OR,Pa,RPa,S>>;
    readonly error?: ValueError;
    readonly isValid: boolean;
    readonly security?: SecurityApi.SecurityRequirementObject[]
}
