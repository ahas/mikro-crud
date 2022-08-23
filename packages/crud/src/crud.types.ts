import { ToNumber, ToString } from "@ahas/class-converter";
import { CrudParamTypes } from "./decorators";
import deepmerge from "deepmerge";
import type { AnyEntity, Loaded, RequiredEntityData, QueryOrderMap } from "@mikro-orm/core";
import type { AutoPath, EntityDTO } from "@mikro-orm/core/typings";
import type { S3 } from "aws-sdk";

export type PrimaryKeys<T> = Record<keyof T & string, any>;

export class CrudCreateDto<T> {}
export class CrudUpdateDto<T> {}

export interface RequestData<T_Name extends string, T_Entity> {
  req: Express.Request;
  res: Express.Response;
  params: PrimaryKeys<T_Entity>;
  query?: CrudSearchQuery<T_Entity>;
  body?: CrudDto<T_Name, T_Entity> | T_Entity[];
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

export interface CrudOptions<
  T_Name extends string,
  T_Entity extends AnyEntity<T_Entity>,
  P extends string = never,
  T_CreateDto = any,
  T_UpdateDto = any,
> {
  name: T_Name;
  entity: new (...args: any[]) => T_Entity;
  path?: string;
  prefix?: string;
  filter?: AutoPath<T_Entity, P>[];
  populate?:
    | AutoPath<T_Entity, P>[]
    | {
        search?: AutoPath<T_Entity, P>[];
        get?: AutoPath<T_Entity, P>[];
      }
    | boolean;
  primaryKeys?: (keyof T_Entity & string)[];
  dto?: {
    create?: new () => T_CreateDto;
    update?: new () => T_UpdateDto;
  };
  default?: {
    offset?: number;
    limit?: number;
  };
  aws?: {
    s3: S3;
    bucket: string;
  };
}

export class CrudSearchQuery<T_Entity extends AnyEntity<T_Entity>> {
  [key: string]: any;
  @ToString({ optional: true, api: true })
  readonly search?: string;
  @ToString({ optional: true, api: true })
  readonly category?: keyof T_Entity & string;
  @ToString({ optional: true, api: true })
  readonly sort?: keyof QueryOrderMap<T_Entity>;
  @ToString({ optional: true, api: true })
  readonly order?: "asc" | "desc";
  @ToNumber({ optional: true, api: true })
  readonly offset?: number;
  @ToNumber({ optional: true, api: true })
  readonly limit?: number;

  toFilter(appendix?: Record<string, any>) {
    const where: Record<string, any> = {};
    if (this.search) {
      if (this.category) {
        this.setSearchQuery(where, this.category, {
          $like: `%${this.search}%`,
        });
      } else if (this.options.filter) {
        where.$or = [];
        for (const column of this.options.filter) {
          const q = {};
          where.$or.push(
            this.setSearchQuery(q, column as string, {
              $like: `%${this.search}%`,
            }),
          );
        }
      }
    }

    if (appendix) {
      return deepmerge(where, appendix);
    }

    return where;
  }

  private setSearchQuery(query: object, path: string, value: any): object {
    const keys = path.split(".");
    let target = query;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (i + 1 < keys.length) {
        if (!(key in target)) {
          target[key] = {};
        }
        target = target[key];
      } else {
        target[key] = value;
      }
    }

    return query;
  }
}

export type CrudSearchResult<T_Entity extends AnyEntity<T_Entity>, P extends string = never> = {
  items: EntityDTO<Loaded<T_Entity, P>>[];
  count: number;
};

export type CrudGetResult<T_Name extends string, T_Entity extends AnyEntity<T_Entity>, P extends string = never> = {
  [key in T_Name]: Loaded<T_Entity, P>;
};

export type CrudDto<T_Name extends string, T_Entity extends AnyEntity<T_Entity>> = {
  [key in T_Name]: RequiredEntityData<T_Entity>;
};

export enum CrudHooks {
  SEARCH_QUERY = "search-query",
  BEFORE_SEARCH = "before-search",
  AFTER_SEARCH = "after-search",
  GET_QUERY = "get-query",
  BEFORE_GET = "before-get",
  AFTER_GET = "after-get",
  BEFORE_VIEW = "before-view",
  AFTER_VIEW = "after-view",
  BEFORE_CREATE = "before-create",
  AFTER_CREATE = "after-create",
  BEFORE_UPDATE = "before-update",
  AFTER_UPDATE = "after-update",
  BEFORE_DELETE = "before-delete",
  AFTER_DELETE = "after-delete",
  BEFORE_FLUSH = "before-flush",
  AFTER_FLUSH = "after-flush",
  BEFORE_PERSIST = "before-persist",
  AFTER_PERSIST = "after-persist",
  BEFORE_COMMIT = "before-commit",
  AFTER_COMMIT = "after-commit",
  BEFORE_ROLLBACK = "before-rollback",
  AFTER_ROLLBACK = "after-rollback",
  BEFORE_UPSERT = "before-upsert",
  AFTER_UPSERT = "after-upsert",
}

export interface CrudListenerMetadataArgs {
  readonly target: Function;
  readonly propertyName: string;
  readonly type: CrudHooks;
}

export type WhereQuery<T> = { [key in keyof T & string]: any };

export type CrudParams = { [key in CrudParamTypes]?: any };
