import { ToNumber, ToString } from "@ahas/class-converter";
import { AnyEntity, Loaded, RequiredEntityData, EntityDTO, QueryOrderMap } from "@mikro-orm/core";
import { AutoPath } from "@mikro-orm/core/typings";
import deepmerge from "deepmerge";
import { CrudParamTypes } from "./decorators";

export class CrudCreateDTO<T> {}
export class CrudUpdateDTO<T> {}

export interface CrudOptions<
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never,
    T_CreateDTO = any,
    T_UpdateDTO = any,
> {
    name: T_CrudName;
    entity: new () => T_CrudEntity;
    path?: string;
    prefix?: string;
    filter?: AutoPath<T_CrudEntity, P>[];
    populate?: AutoPath<T_CrudEntity, P>[] | boolean;
    primaryKeys?: (keyof T_CrudEntity & string)[];
    dto?: {
        create?: new () => T_CreateDTO;
        update?: new () => T_UpdateDTO;
    };
    offset?: number;
    limit?: number;
}

export class CrudSearchQuery<T_CrudEntity extends AnyEntity<T_CrudEntity>> {
    [key: string]: any;
    @ToString({ optional: true, api: true })
    readonly search?: string;
    @ToString({ optional: true, api: true })
    readonly category?: keyof T_CrudEntity & string;
    @ToString({ optional: true, api: true })
    readonly sort?: keyof QueryOrderMap<T_CrudEntity>;
    @ToString({ optional: true, api: true })
    readonly order?: "asc" | "desc";
    @ToNumber({ optional: true, api: true })
    readonly offset?: number;
    @ToNumber({ optional: true, api: true })
    readonly limit?: number;

    toFilter(appendix?: Record<string, any>) {
        const where: Record<string, any>  = {};
        if (this.search) {
            if (this.category) {
                this.setSearchQuery(where, this.category, { $like: `%${this.search}%` });
            } else if (this._options.filter) {
                where.$or = [];
                for (const column of this._options.filter) {
                    const q = {};
                    where.$or.push(this.setSearchQuery(q, column as string, { $like: `%${this.search}%` }));
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

export type CrudSearchResult<T_CrudEntity extends AnyEntity<T_CrudEntity>, P extends string = never> = {
    items: EntityDTO<Loaded<T_CrudEntity, P>>[];
    count: number;
};

export type CrudGetResult<
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never,
> = {
    [key in T_CrudName]: Loaded<T_CrudEntity, P>;
};

export type CrudDTO<T_CrudName extends string, T_CrudEntity extends AnyEntity<T_CrudEntity>> = {
    [key in T_CrudName]: RequiredEntityData<T_CrudEntity>;
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
}

export interface CrudListenerMetadataArgs {
    readonly target: Function;
    readonly propertyName: string;
    readonly type: CrudHooks;
}

export type WhereQuery<T> = {
    [key in keyof T & string]: any;
};

export type CrudParams = {
    [key in CrudParamTypes]?: any;
};
