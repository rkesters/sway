import { Parameter } from './parameter';
import { Path } from './path';
import { DocumentApi, OperationApi, ParameterApi, PathApi, SecurityApi } from './typedefs';

export interface Operation<
    O extends OperationApi.OperationObject,
    OR extends OperationApi.resolved.OperationObject,
    S extends SecurityApi.SecurityRequirementObject,
    D extends DocumentApi.resolved.Document,
    P extends PathApi.PathItemObject,
    R extends PathApi.resolved.PathItemObject,
    Pa extends ParameterApi.ParameterObject,
    RPa extends ParameterApi.resolved.ParameterObject
> {
    readonly definition: O;
    readonly definitionFullyResolved: OR;
    readonly method: string;
    readonly pathObject: Path<D, P, R, O, OR, Pa, RPa, S>;
    readonly pathToDefinition: string[];
    readonly parameterObjects: Parameter<Pa, RPa, D, P, R, O, OR, S>[];
    readonly ptr: string;
    readonly security: S[];
    readonly operationId: string;
    readonly tags: string[];
    readonly consumes?: string[];
    readonly produces?: string[];
    readonly schemes?: string[];
    readonly deprecated?: boolean;

    isOperation: (value: unknown) => value is Operation<O, OR, S, D, P, R, Pa, RPa>;
}
