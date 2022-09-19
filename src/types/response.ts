import { Operation } from './operation';
import {
    DocumentApi,
    OperationApi,
    ParameterApi,
    PathApi,
    ResponseApi,
    SecurityApi,
} from './typedefs';

export interface Response<
    RS extends ResponseApi.ResponseObject,
    RRS extends ResponseApi.resolved.ResponseObject,
    O extends OperationApi.OperationObject,
    OR extends OperationApi.resolved.OperationObject,
    S extends SecurityApi.SecurityRequirementObject,
    D extends DocumentApi.resolved.Document,
    P extends PathApi.PathItemObject,
    R extends PathApi.resolved.PathItemObject,
    Pa extends ParameterApi.ParameterObject,
    RPa extends ParameterApi.resolved.ParameterObject
> {
    definition: RS;
    definitionFullyResolved: RRS;
    operationObject: Operation<O, OR, S, D, P, R, Pa, RPa>;
    pathToDefinition: string[];
    ptr: string;
    statusCode: string;
    headers: Record<string, any>
}
