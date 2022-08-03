import type { AnyEntity, EntityManager, FindOneOptions, FindOptions } from "@mikro-orm/core";
import { ModuleRef } from "@nestjs/core";
import { CrudParamTypes } from "./decorators";
import { CrudDTO, CrudHooks, CrudOptions, CrudSearchQuery, WhereQuery } from "./crud.types";
import { getMetadataStorage } from "./metadata-storage";

export class CrudArgsData<
  T_CrudName extends string,
  T_CrudEntity extends AnyEntity<T_CrudEntity>,
  P extends string = never,
> {
  [CrudParamTypes.ENTITY_MANAGER]?: EntityManager;
  [CrudParamTypes.KEYS]: (keyof T_CrudEntity & string)[];
  [CrudParamTypes.REQUEST]: Express.Request;
  [CrudParamTypes.RESPONSE]: Express.Response;
  [CrudParamTypes.QUERY]?: CrudSearchQuery<T_CrudEntity>;
  [CrudParamTypes.PARAMS]?: any;
  [CrudParamTypes.BODY]?: T_CrudEntity[] | CrudDTO<T_CrudName, T_CrudEntity>;
  [CrudParamTypes.FILTER]?: WhereQuery<T_CrudEntity>;
  [CrudParamTypes.FILE]?: Express.Multer.File | null;
  [CrudParamTypes.FILES]?: Express.Multer.File[];
  [CrudParamTypes.OPTIONS]?: FindOptions<T_CrudEntity, P> | FindOneOptions<T_CrudEntity, P>;
}

export class CrudArgs<
  T_CrudName extends string,
  T_CrudEntity extends AnyEntity<T_CrudEntity>,
  P extends string = never,
> {
  data: CrudArgsData<T_CrudName, T_CrudEntity, P>;
  moduleRef: ModuleRef;
  options: CrudOptions<T_CrudName, T_CrudEntity, P>;

  constructor(
    em: EntityManager,
    moduleRef: ModuleRef,
    options: CrudOptions<T_CrudName, T_CrudEntity, P>,
    data: CrudArgsData<T_CrudName, T_CrudEntity, P>,
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
