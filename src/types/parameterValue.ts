import { DocumentNode, GeneralDocument } from '@rkesters/json-refs';
import { has, isPlainObject } from 'lodash';
import { Parameter } from './parameter';
import {
    DocumentApi,
    OperationApi,
    ParameterApi,
    PathApi,
    SecurityApi,
    ValueError,
} from './typedefs';

export interface ParameterValue<
    P extends ParameterApi.ParameterObject,
    RP extends ParameterApi.resolved.ParameterObject,
    D extends DocumentApi.resolved.Document,
    PA extends PathApi.PathItemObject,
    R extends PathApi.resolved.PathItemObject,
    O extends OperationApi.OperationObject,
    OR extends OperationApi.resolved.OperationObject,
    S extends SecurityApi.SecurityRequirementObject
> {
    readonly parameterObject: Parameter<P, RP, D, PA, R, O, OR, S>;
    readonly raw: any;
    readonly errors?: ValueError[];
    readonly error?: ValueError;
    readonly valid: boolean;
    readonly value: DocumentNode;
}

export interface InvalidParameterValue {
    readonly errors: ValueError[];
    readonly error: ValueError;
    readonly valid: false;
}

export function isInvalidParameterValue(value: unknown): value is InvalidParameterValue {
  return isPlainObject(value) && !(value as any).valid ;
}
