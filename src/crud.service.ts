import {
    AnyEntity,
    EntityMetadata,
    FilterQuery,
    FindOneOptions,
    FindOptions,
    MikroORM,
    QueryFlag,
    QueryOrder,
    QueryOrderMap,
    wrap,
} from "@mikro-orm/core";
import { AutoPath } from "@mikro-orm/core/typings";
import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";
import {
    CrudDTO,
    CrudHooks,
    CrudGetResult,
    CrudOptions,
    CrudSearchQuery,
    CrudSearchResult,
    WhereQuery,
} from "./crud.types";
import { getMetadataStorage, MetadataStorage } from "./metadata-storage";
import { CrudParamTypes } from "./decorators";
import { Request } from "express";
import { ModuleRef } from "@nestjs/core";
import { assignEntity, toPlainObject } from "./crud.utils";

export type PrimaryKeys<T> = Record<keyof T & string, any>;
@Injectable()
export class CrudService<
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never,
> {
    private _metadata: EntityMetadata<T_CrudEntity>;
    private _options: CrudOptions<T_CrudName, T_CrudEntity, P>;
    private _populate: AutoPath<T_CrudEntity, P>[] | boolean;
    private _metadataStorage: MetadataStorage;

    constructor(
        private readonly orm: MikroORM,
        private readonly em: EntityManager,
        private moduleRef: ModuleRef,
        @Inject("CRUD_OPTIONS") options: CrudOptions<T_CrudName, T_CrudEntity, P>,
    ) {
        this._options = options;
        if (options.filter) {
            this._populate = options.filter.filter((x) => String(x).indexOf(".") >= 0);
        } else {
            this._populate = options.populate || false;
        }
        this._options.filter = options.filter;
        this._options.offset = 0;
        this._options.limit = 300;
        this._metadata = this.em.getMetadata().find<T_CrudEntity>(this._options.entity.name)!;
        this._metadataStorage = getMetadataStorage();
    }

    async search(data: {
        req: Request;
        query: CrudSearchQuery<T_CrudEntity>;
        params: any[];
    }): Promise<CrudSearchResult<T_CrudEntity, P>> {
        const em = this.orm.em.fork();
        await em.begin();

        try {
            const primaryKeys = this._metadata.primaryKeys;
            const options: FindOptions<T_CrudEntity, P> = {
                populate: this._populate,
                offset: data.query.offset || this._options.offset,
                flags: [QueryFlag.PAGINATE],
            };

            if (data.query.limit) {
                options.limit = data.query.limit;
            } else if (this._options.limit !== Infinity) {
                options.limit = this._options.limit;
            }

            if (data.query.sort) {
                options.orderBy = {
                    [data.query.sort]: data.query.order?.toLowerCase() === "asc" ? QueryOrder.ASC : QueryOrder.DESC,
                } as QueryOrderMap<T_CrudEntity>;
            } else {
                options.orderBy = {
                    [this._metadata.primaryKeys[0]]: QueryOrder.DESC,
                } as QueryOrderMap<T_CrudEntity>;
            }

            const hookArgs = {
                [CrudParamTypes.KEYS]: primaryKeys,
                [CrudParamTypes.REQUEST]: data.req,
                [CrudParamTypes.QUERY]: data.query,
                [CrudParamTypes.PARAMS]: data.params,
                [CrudParamTypes.OPTIONS]: options,
            };
            const entityName = this._metadata.name!;

            let appendix = {};
            if (this._options.filter) {
                appendix = this._options.filter.reduce((a, b) => {
                    if (b in data.query) {
                        a[b] = data.query[b];
                    }
                    return a;
                }, {} as any);
            }

            let where: Record<string, any> = data.query.toFilter(appendix);
            hookArgs[CrudParamTypes.FILTER] = where;

            where =
                (await this.callHook(em, CrudHooks.SEARCH_QUERY, {
                    ...hookArgs,
                })) || where;

            hookArgs[CrudParamTypes.FILTER] = where;
            where =
                (await this.callHook(em, CrudHooks.BEFORE_SEARCH, {
                    ...hookArgs,
                })) || where;
            hookArgs[CrudParamTypes.FILTER] = where;

            const result = await em.findAndCount<T_CrudEntity, P>(
                entityName,
                where as FilterQuery<T_CrudEntity>,
                options,
            );
            hookArgs[CrudParamTypes.FILTER] = {
                items: result[0],
                count: result[1],
            };

            result[0] =
                (await this.callHook(em, CrudHooks.AFTER_SEARCH, {
                    ...hookArgs,
                })) || result[0];

            await em.flush();
            await em.commit();

            return {
                items: result[0].map((x) => wrap(x).toPOJO()),
                count: result[1],
            };
        } catch (e) {
            await em.rollback();
            throw e;
        }
    }

    private async findOne(
        em: EntityManager,
        data: Partial<{ req: Request; query: any; params: PrimaryKeys<T_CrudEntity> }>,
    ) {
        const options: FindOneOptions<T_CrudEntity, P> = { populate: true, cache: false };
        const entityName = this._metadata.name!;
        const primaryKeys = this._metadata.primaryKeys;
        const hookArgs = {
            [CrudParamTypes.REQUEST]: data.req,
            [CrudParamTypes.PARAMS]: data.params,
            [CrudParamTypes.QUERY]: data.query,
            [CrudParamTypes.KEYS]: primaryKeys,
            [CrudParamTypes.OPTIONS]: options,
        };
        let where = ((await this.callHook(em, CrudHooks.GET_QUERY, {
            ...hookArgs,
        })) || {}) as WhereQuery<T_CrudEntity>;

        for (const pk of primaryKeys) {
            where[pk] = data.params[pk];
        }

        hookArgs[CrudParamTypes.FILTER] = where;
        where =
            ((await this.callHook(em, CrudHooks.BEFORE_GET, {
                ...hookArgs,
            })) as WhereQuery<T_CrudEntity>) || where;

        let entity = await em.findOne<T_CrudEntity, P>(entityName, where as FilterQuery<T_CrudEntity>, options);
        hookArgs[CrudParamTypes.FILTER] = where;
        hookArgs[CrudParamTypes.ENTITIES] = [entity];

        entity =
            (await this.callHook(em, CrudHooks.AFTER_GET, {
                ...hookArgs,
            })) || entity;

        return entity;
    }

    async get(data: {
        req: Request;
        query: any;
        params: PrimaryKeys<T_CrudEntity>;
    }): Promise<CrudGetResult<T_CrudName, T_CrudEntity, P>> {
        const em = this.orm.em.fork();
        await em.begin();

        try {
            const entityName = this._metadata.name!;
            const primaryKeys = this._metadata.primaryKeys;

            const options = {};
            let where = {} as WhereQuery<T_CrudEntity>;
            const hookArgs = {
                [CrudParamTypes.KEYS]: primaryKeys,
                [CrudParamTypes.REQUEST]: data.req,
                [CrudParamTypes.PARAMS]: data.params,
                [CrudParamTypes.QUERY]: data.query,
                [CrudParamTypes.FILTER]: where,
                [CrudParamTypes.OPTIONS]: options,
            };
            where = ((await this.callHook(em, CrudHooks.GET_QUERY, {
                ...hookArgs,
            })) || {}) as WhereQuery<T_CrudEntity>;

            for (const pk of primaryKeys) {
                where[pk] = data.params[pk];
            }
            hookArgs[CrudParamTypes.FILTER] = where;
            where =
                ((await this.callHook(em, CrudHooks.BEFORE_GET, {
                    ...hookArgs,
                })) as WhereQuery<T_CrudEntity>) || where;

            hookArgs[CrudParamTypes.FILTER] = where;
            where =
                ((await this.callHook(em, CrudHooks.BEFORE_VIEW, {
                    ...hookArgs,
                })) as WhereQuery<T_CrudEntity>) || where;

            let entity = await em.findOne<T_CrudEntity, P>(entityName, where as FilterQuery<T_CrudEntity>, options);
            hookArgs[CrudParamTypes.FILTER] = where;
            hookArgs[CrudParamTypes.ENTITIES] = [entity];
            entity =
                (await this.callHook(em, CrudHooks.AFTER_GET, {
                    ...hookArgs,
                })) || entity;

            hookArgs[CrudParamTypes.ENTITIES] = [entity];
            entity =
                (await this.callHook(em, CrudHooks.AFTER_VIEW, {
                    ...hookArgs,
                })) || entity;

            await em.flush();
            await em.commit();
            return {
                [this._options.name]: wrap(entity).toPOJO(),
            } as CrudGetResult<T_CrudName, T_CrudEntity, P>;
        } catch (e) {
            await em.rollback();
            throw e;
        }
    }

    async create(data: {
        req: Request;
        params: any;
        body: CrudDTO<T_CrudName, T_CrudEntity> | T_CrudEntity[];
        file: Express.Multer.File;
        files: Express.Multer.File[];
    }): Promise<PrimaryKeys<T_CrudEntity>> {
        const em = this.orm.em.fork();
        await em.begin();

        try {
            const options = {};
            const primaryKeys = this._metadata.primaryKeys;
            const hookArgs = {
                [CrudParamTypes.KEYS]: primaryKeys,
                [CrudParamTypes.REQUEST]: data.req,
                [CrudParamTypes.PARAMS]: data.params,
                [CrudParamTypes.BODY]: data.body,
                [CrudParamTypes.FILE]: data.file,
                [CrudParamTypes.FILES]: data.files,
            };
            const entityName = this._metadata.name!;
            data =
                (await this.callHook(em, CrudHooks.BEFORE_CREATE, {
                    ...hookArgs,
                })) || data;

            let entities: T_CrudEntity[] = [];
            if (Array.isArray(data.body)) {
                entities.push(...data.body.map((x) => em.create<T_CrudEntity>(entityName, x)));
            } else {
                entities.push(em.create<T_CrudEntity>(entityName, data.body[this._options.name]));
            }
            hookArgs[CrudParamTypes.ENTITIES] = entities;
            entities =
                (await this.callHook(em, CrudHooks.AFTER_CREATE, {
                    ...hookArgs,
                })) || entities;
            entities = Array.isArray(entities) ? entities : [entities];

            hookArgs[CrudParamTypes.ENTITIES] = entities;
            entities =
                (await this.callHook(em, CrudHooks.BEFORE_FLUSH, {
                    ...hookArgs,
                })) || entities;
            entities = Array.isArray(entities) ? entities : [entities];

            for (const entity of entities) {
                await em.persist(entity);
            }
            await em.flush();

            hookArgs[CrudParamTypes.ENTITIES] = entities;
            entities =
                (await this.callHook(em, CrudHooks.AFTER_FLUSH, {
                    ...hookArgs,
                })) || entities;
            entities = Array.isArray(entities) ? entities : [entities];

            const result: PrimaryKeys<T_CrudEntity> = {} as PrimaryKeys<T_CrudEntity>;

            if (entities.length === 1) {
                for (const pk of primaryKeys) {
                    result[pk] = entities[0][pk];
                }
            } else {
                for (const pk of primaryKeys) {
                    result[pk] = entities.map((x) => x[pk]);
                }
            }

            await em.commit();
            return result;
        } catch (e) {
            await em.rollback();
            throw e;
        }
    }

    async update(data: {
        req: Request;
        params: PrimaryKeys<T_CrudEntity>;
        body: CrudDTO<T_CrudName, T_CrudEntity>;
        file: Express.Multer.File;
        files: Express.Multer.File[];
    }): Promise<void> {
        const em = this.orm.em.fork();
        await em.begin();

        try {
            const primaryKeys = this._metadata.primaryKeys;
            const hookArgs = {
                [CrudParamTypes.KEYS]: primaryKeys,
                [CrudParamTypes.REQUEST]: data.req,
                [CrudParamTypes.PARAMS]: data.params,
                [CrudParamTypes.BODY]: data.body,
                [CrudParamTypes.FILE]: data.file,
                [CrudParamTypes.FILES]: data.files,
            };
            let entity = await this.findOne(em, data);
            if (entity) {
                data =
                    (await this.callHook(em, CrudHooks.BEFORE_UPDATE, {
                        ...hookArgs,
                    })) || data;

                if (!data.body[this._options.name]) {
                    const availableKeys = Object.keys(data.body).join(", ");
                    const error = new Error(
                        `CRUD Update Error: "body" does not have a "${this._options.name}", "body" contains "${availableKeys}"`,
                    );
                    throw error;
                }
                const json = toPlainObject(data.body[this._options.name]);
                // assignEntity(em, entity, json);
                em.assign(entity, json, {
                    updateByPrimaryKey: false,
                    mergeObjects: true,
                    merge: true,
                });
                hookArgs[CrudParamTypes.ENTITIES] = [entity];
                entity =
                    (await this.callHook(em, CrudHooks.AFTER_UPDATE, {
                        ...hookArgs,
                    })) || entity;

                hookArgs[CrudParamTypes.ENTITIES] = [entity];
                entity =
                    (await this.callHook(em, CrudHooks.BEFORE_FLUSH, {
                        ...hookArgs,
                    })) || entity;
                await em.persistAndFlush(entity);

                hookArgs[CrudParamTypes.ENTITIES] = [entity];
                entity =
                    (await this.callHook(em, CrudHooks.AFTER_FLUSH, {
                        ...hookArgs,
                    })) || entity;
            }
            await em.commit();
        } catch (e) {
            await em.rollback();
            throw e;
        }
    }

    async delete(data: { req: Request; params: PrimaryKeys<T_CrudEntity> }): Promise<void> {
        const em = this.orm.em.fork();
        await em.begin();

        try {
            const primaryKeys = this._metadata.primaryKeys;
            const hookArgs = {
                [CrudParamTypes.KEYS]: primaryKeys,
                [CrudParamTypes.REQUEST]: data.req,
                [CrudParamTypes.PARAMS]: data.params,
            };

            let entity = await this.findOne(em, data);
            if (entity) {
                hookArgs[CrudParamTypes.ENTITIES] = [entity];
                entity =
                    (await this.callHook(em, CrudHooks.BEFORE_DELETE, {
                        ...hookArgs,
                    })) || entity;
                await em.remove<T_CrudEntity>(entity).flush();

                hookArgs[CrudParamTypes.ENTITIES] = [entity];
                await this.callHook(em, CrudHooks.AFTER_DELETE, {
                    ...hookArgs,
                });
            }
            await em.commit();
        } catch (e) {
            await em.rollback();
            throw e;
        }
    }

    callHook<T = any>(
        em: EntityManager,
        eventType: CrudHooks,
        args: { [key in CrudParamTypes]?: any },
    ): T | Promise<T> | undefined | Promise<undefined> {
        args[CrudParamTypes.ENTITY_MANAGER] = em;
        return this._metadataStorage.emit(this.moduleRef, this._options.path || this._options.name, eventType, args);
    }
}
