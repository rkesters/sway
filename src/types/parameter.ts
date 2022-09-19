import type { GeneralDocument } from '@rkesters/json-refs';
import type { Operation } from './operation';
import { Path } from './path';
import { DocumentApi, OperationApi, ParameterApi, PathApi, SchemaApi, SecurityApi } from './typedefs';

export interface Parameter<
    P extends  ParameterApi.ParameterObject,
    RP extends ParameterApi.resolved.ParameterObject,
    D extends  DocumentApi.resolved.Document,
    PA extends PathApi.PathItemObject,
    R extends  PathApi.resolved.PathItemObject,
    O extends  OperationApi.OperationObject,
    OR extends OperationApi.resolved.OperationObject,
    S extends  SecurityApi.SecurityRequirementObject
> {
    readonly definition: P;
    readonly definitionFullyResolved: RP;
    readonly operationObject?: Operation<O, OR,S, D, PA, R, P, RP>;
    readonly pathObject: Path<D, PA, R, O, OR, P, RP,S>;
    readonly pathToDefinition: string[];
    readonly ptr: string;
    readonly schema?: SchemaApi.resolved.SchemaObject
    readonly allowEmptyValue: boolean;
    readonly required:boolean;
    readonly type?: string;
    readonly collectionFormat?: string;
    readonly in: string;
    readonly name: string;
}

export interface InvalidParameter {

}
