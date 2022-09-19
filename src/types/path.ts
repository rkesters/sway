import { Operation } from './operation';
import { Parameter } from './parameter';
import { ISwaggerApi } from './api';
import { DocumentApi, OperationApi, ParameterApi, PathApi, SecurityApi } from './typedefs';
import { Key } from 'path-to-regexp';

export interface Path<
    D extends DocumentApi.resolved.Document,
    P extends PathApi.PathItemObject,
    R extends PathApi.resolved.PathItemObject,
    O extends OperationApi.OperationObject,
    OR extends OperationApi.resolved.OperationObject,
    Pa extends ParameterApi.ParameterObject,
    RPa extends ParameterApi.resolved.ParameterObject,
    S extends SecurityApi.SecurityRequirementObject
> {
    api: ISwaggerApi<D,P,R,O,OR,Pa,RPa,S>;
    definition: P;
    definitionFullyResolved: R;
    operationObjects: Operation<O,OR,S,D,P,R, Pa,RPa>[];
    parameterObjects: Parameter<Pa,RPa,D,P,R,O,OR,S>[];
    path: string;
    pathToDefinition: string[];
    ptr: string;
    regexp: RegExp;
    keys: Key[];
}
