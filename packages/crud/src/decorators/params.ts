import { ParamData, PipeTransform, Type } from "@nestjs/common";

export enum CrudParamTypes {
  ENTITY_MANAGER,
  QUERY,
  PARAMS,
  KEYS,
  FILTER,
  OPTIONS,
  BODY,
  FILES,
  FILE,
  ENTITY,
  ENTITIES,
  REQUEST,
  RESPONSE,
}

export interface CrudParamMetadata {
  index: number;
  data?: ParamData;
}

export const CRUD_ARGS_METADATA = "__crudArguments__";

const isUndefined = (obj: any): obj is undefined => typeof obj === "undefined";
const isNil = (val: any): val is null | undefined => isUndefined(val) || val === null;
const isString = (val: any): val is string => typeof val === "string";

export function assignMetadata<TParamType = any, TArgs = any>(
  args: TArgs,
  type: TParamType,
  index: number,
  data?: ParamData,
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
) {
  return {
    ...args,
    [`${type}:${index}`]: {
      type: type,
      index,
      data,
      pipes,
    },
  };
}

function createCrudParamDecorator(paramType: CrudParamTypes) {
  return (data?: ParamData): ParameterDecorator =>
    (target, key, index) => {
      const args = Reflect.getMetadata(CRUD_ARGS_METADATA, target.constructor, key) || {};
      Reflect.defineMetadata(
        CRUD_ARGS_METADATA,
        assignMetadata<CrudParamTypes, Record<number, CrudParamMetadata>>(args, paramType, index, data),
        target.constructor,
        key,
      );
    };
}

export const Query: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.QUERY);
export const Filter: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.FILTER);
export const Options: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.OPTIONS);
export const Keys: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.KEYS);
export const Body: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.BODY);
export const File: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.FILE);
export const Files: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.FILES);
export const Req: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.REQUEST);
export const Res: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.RESPONSE);
export const Entities: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.ENTITIES);
export const Entity: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.ENTITY);
export const EM: () => ParameterDecorator = createCrudParamDecorator(CrudParamTypes.ENTITY_MANAGER);
