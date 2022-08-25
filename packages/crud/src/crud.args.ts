import type { AnyEntity, EntityManager, FindOneOptions, FindOptions } from "@mikro-orm/core";
import { CrudParamTypes } from "./decorators";
import { CrudDto, CrudHooks, CrudOptions, CrudSearchQuery, WhereQuery } from "./crud.types";
import { getMetadataStorage } from "./metadata-storage";
import { ModuleRef } from "@nestjs/core";

export class CrudArgsData<T_Name extends string, T_Entity extends AnyEntity<T_Entity>, P extends string = never> {
  [CrudParamTypes.ENTITY_MANAGER]?: EntityManager;
  [CrudParamTypes.KEYS]: (keyof T_Entity & string)[];
  [CrudParamTypes.REQUEST]: Express.Request;
  [CrudParamTypes.RESPONSE]: Express.Response;
  [CrudParamTypes.QUERY]?: CrudSearchQuery<T_Entity>;
  [CrudParamTypes.PARAMS]?: any;
  [CrudParamTypes.BODY]?: T_Entity[] | CrudDto<T_Name, T_Entity>;
  [CrudParamTypes.FILTER]?: WhereQuery<T_Entity>;
  [CrudParamTypes.FILE]?: Express.Multer.File | null;
  [CrudParamTypes.FILES]?: Express.Multer.File[];
  [CrudParamTypes.OPTIONS]?: FindOptions<T_Entity, P> | FindOneOptions<T_Entity, P>;
}

export class CrudArgs<T_Name extends string, T_Entity extends AnyEntity<T_Entity>, P extends string = never> {
  data: CrudArgsData<T_Name, T_Entity, P>;
  moduleRef: ModuleRef;
  options: CrudOptions<T_Name, T_Entity, P>;

  constructor(
    em: EntityManager,
    moduleRef: ModuleRef,
    options: CrudOptions<T_Name, T_Entity, P>,
    data: CrudArgsData<T_Name, T_Entity, P>,
  ) {
    this.moduleRef = moduleRef;
    this.options = options;

    this.data = { ...data };
    this.data[CrudParamTypes.ENTITY_MANAGER] = em;
    this.data[CrudParamTypes.ENTITY] = this.data[CrudParamTypes.ENTITY] || null;
    this.data[CrudParamTypes.ENTITIES] = this.data[CrudParamTypes.ENTITIES] || [];
    this.data[CrudParamTypes.BODY] = this.data[CrudParamTypes.BODY] || null;
    this.data[CrudParamTypes.QUERY] = this.data[CrudParamTypes.QUERY] || ({} as any);
    this.data[CrudParamTypes.OPTIONS] = this.data[CrudParamTypes.OPTIONS] || ({} as any);
    this.data[CrudParamTypes.FILTER] = this.data[CrudParamTypes.FILTER] || ({} as any);
    this.data[CrudParamTypes.FILE] = this.data[CrudParamTypes.FILE] || null;
    this.data[CrudParamTypes.FILES] = this.data[CrudParamTypes.FILES] || [];
  }

  async call<T>(eventType: CrudHooks, defaultValue?: T): Promise<T> {
    const ms = getMetadataStorage();

    const ret = (await ms.emit(this.moduleRef, this.options.path || this.options.name, eventType, this.data)) as T;

    return ret || defaultValue;
  }

  async exec<T>(eventType: CrudHooks, defaultReturn: CrudParamTypes): Promise<T> {
    this.data[defaultReturn] = await this.call(eventType, this.data[defaultReturn]);

    if (defaultReturn === CrudParamTypes.ENTITY) {
      this.data[CrudParamTypes.ENTITIES] = [this.data[CrudParamTypes.ENTITY]];
    } else if (defaultReturn === CrudParamTypes.ENTITIES) {
      this.data[CrudParamTypes.ENTITY] = this.data[CrudParamTypes.ENTITIES][0];
    }

    return this.data[defaultReturn];
  }

  setEntity(e: any | any[]) {
    if (Array.isArray(e)) {
      this.data[CrudParamTypes.ENTITY] = e[0];
      this.data[CrudParamTypes.ENTITIES] = e;
    } else {
      this.data[CrudParamTypes.ENTITY] = e;
      this.data[CrudParamTypes.ENTITIES] = [e];
    }
  }
}
