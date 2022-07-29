import {
    AnyEntity,
    EntityMetadata,
    FilterQuery,
    FindOneOptions,
    FindOptions,
    QueryFlag,
    QueryOrder,
    QueryOrderMap,
    wrap,
} from "@mikro-orm/core";
import { AutoPath, Loaded } from "@mikro-orm/core/typings";
import { EntityManager } from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";
import {
    CrudDTO,
    CrudHooks,
    CrudGetResult,
    CrudOptions,
    CrudSearchQuery,
    CrudSearchResult,
    PrimaryKeys,
    WhereQuery,
} from "./crud.types";
import { ModuleRef } from "@nestjs/core";
import { toPlainObject } from "./crud.utils";
import { CrudArgs } from "./crud.args";
import { CrudParamTypes } from "./decorators";

@Injectable()
export class CrudService<
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never,
> {
    private _metadata: EntityMetadata<T_CrudEntity>;
    private options: CrudOptions<T_CrudName, T_CrudEntity, P>;
    private _populate: AutoPath<T_CrudEntity, P>[] | boolean;

    constructor(
        private readonly em: EntityManager,
        private moduleRef: ModuleRef,
        @Inject("CRUD_OPTIONS")
        options: CrudOptions<T_CrudName, T_CrudEntity, P>,
    ) {
        this.options = options;
        if (options.filter) {
            this._populate = options.filter.filter(
                (x) => String(x).indexOf(".") >= 0,
            );
        } else {
            this._populate = options.populate || false;
        }
        this.options.filter = options.filter;
        this.options.offset = 0;
        this.options.limit = 300;
        this._metadata = this.em
            .getMetadata()
            .find<T_CrudEntity>(this.options.entity.name)!;
    }

    async search(data: {
        req: Express.Request;
        res: Express.Response;
        query: CrudSearchQuery<T_CrudEntity>;
        params: any[];
    }): Promise<CrudSearchResult<T_CrudEntity, P>> {
        const em = this.em.fork();
        await em.begin();

        const primaryKeys = this._metadata.primaryKeys;
        const entityName = this._metadata.name!;
        const hArgs = new CrudArgs<T_CrudName, T_CrudEntity, P>(
            em,
            this.moduleRef,
            this.options,
            {
                [CrudParamTypes.KEYS]: primaryKeys,
                [CrudParamTypes.REQUEST]: data.req,
                [CrudParamTypes.RESPONSE]: data.res,
                [CrudParamTypes.QUERY]: data.query,
                [CrudParamTypes.PARAMS]: data.params,
                [CrudParamTypes.OPTIONS]: {
                    populate: this._populate,
                    offset: data.query.offset || this.options.offset,
                    flags: [QueryFlag.PAGINATE],
                },
            },
        );

        try {
            const findOptions = hArgs.data[
                CrudParamTypes.OPTIONS
            ] as FindOptions<T_CrudEntity>;

            if (data.query.limit) {
                findOptions.limit = data.query.limit;
            } else if (this.options.limit !== Infinity) {
                findOptions.limit = this.options.limit;
            }

            if (data.query.sort) {
                hArgs.data[CrudParamTypes.OPTIONS].orderBy = {
                    [data.query.sort]:
                        data.query.order?.toLowerCase() === "asc"
                            ? QueryOrder.ASC
                            : QueryOrder.DESC,
                } as QueryOrderMap<T_CrudEntity>;
            } else {
                hArgs.data[CrudParamTypes.OPTIONS].orderBy = {
                    [this._metadata.primaryKeys[0]]: QueryOrder.DESC,
                } as QueryOrderMap<T_CrudEntity>;
            }

            let appendix = {};
            if (this.options.filter) {
                appendix = this.options.filter.reduce((a, b) => {
                    if (b in data.query) {
                        a[b] = data.query[b];
                    }
                    return a;
                }, {} as any);
            }

            hArgs.data[CrudParamTypes.FILTER] = data.query.toFilter(
                appendix,
            ) as WhereQuery<T_CrudEntity>;

            await hArgs.exec(CrudHooks.SEARCH_QUERY, CrudParamTypes.FILTER);
            await hArgs.exec(CrudHooks.BEFORE_SEARCH, CrudParamTypes.FILTER);
            const ret = await em.findAndCount<T_CrudEntity, P>(
                entityName,
                hArgs.data[CrudParamTypes.FILTER] as FilterQuery<T_CrudEntity>,
                hArgs.data[CrudParamTypes.OPTIONS] as FindOptions<
                    T_CrudEntity,
                    P
                >,
            );
            ret[0] = await hArgs.call(CrudHooks.AFTER_SEARCH, ret[0]);

            await hArgs.call(CrudHooks.BEFORE_COMMIT);
            await em.commit();
            await hArgs.call(CrudHooks.AFTER_COMMIT);

            return {
                items: ret[0].map((x) => (x.__helper ? wrap(x).toPOJO() : x)),
                count: ret[1],
            };
        } catch (e) {
            await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
            em.isInTransaction() && (await em.rollback());
            await hArgs.call(CrudHooks.AFTER_ROLLBACK);
            throw e;
        }
    }

    private async findOne(
        em: EntityManager,
        data: Partial<{
            req: Express.Request;
            res: Express.Response;
            query: any;
            params: PrimaryKeys<T_CrudEntity>;
        }>,
    ) {
        const options: FindOneOptions<T_CrudEntity, P> = {
            populate: true,
            cache: false,
        };
        const entityName = this._metadata.name!;
        const primaryKeys = this._metadata.primaryKeys;
        const hArgs = new CrudArgs(em, this.moduleRef, this.options, {
            [CrudParamTypes.REQUEST]: data.req,
            [CrudParamTypes.RESPONSE]: data.res,
            [CrudParamTypes.PARAMS]: data.params,
            [CrudParamTypes.QUERY]: data.query,
            [CrudParamTypes.KEYS]: primaryKeys,
            [CrudParamTypes.OPTIONS]: options,
        });

        const where = await hArgs.exec<WhereQuery<T_CrudEntity>>(
            CrudHooks.GET_QUERY,
            CrudParamTypes.FILTER,
        );

        for (const pk of primaryKeys) {
            where[pk] = data.params[pk];
        }

        return await em.findOne<T_CrudEntity, P>(
            entityName,
            where as FilterQuery<T_CrudEntity>,
            options,
        );
    }

    async get(data: {
        req: Express.Request;
        res: Express.Response;
        query: any;
        params: PrimaryKeys<T_CrudEntity>;
    }): Promise<CrudGetResult<T_CrudName, T_CrudEntity, P>> {
        const em = this.em.fork();
        await em.begin();

        const entityName = this._metadata.name!;
        const primaryKeys = this._metadata.primaryKeys;
        const hArgs = new CrudArgs(this.em, this.moduleRef, this.options, {
            [CrudParamTypes.KEYS]: primaryKeys,
            [CrudParamTypes.REQUEST]: data.req,
            [CrudParamTypes.RESPONSE]: data.res,
            [CrudParamTypes.PARAMS]: data.params,
            [CrudParamTypes.QUERY]: data.query,
        });

        try {
            await hArgs.exec(CrudHooks.GET_QUERY, CrudParamTypes.FILTER);

            for (const pk of primaryKeys) {
                hArgs.data[CrudParamTypes.FILTER] = data.params[pk];
            }
            await hArgs.exec(CrudHooks.BEFORE_GET, CrudParamTypes.FILTER);

            await hArgs.exec(CrudHooks.BEFORE_VIEW, CrudParamTypes.FILTER);

            let entity = await em.findOne<T_CrudEntity, P>(
                entityName,
                hArgs.data[CrudParamTypes.FILTER] as FilterQuery<T_CrudEntity>,
                hArgs.data[CrudParamTypes.OPTIONS],
            );
            await hArgs.setEntity(entity);
            await hArgs.exec(CrudHooks.AFTER_GET, CrudParamTypes.ENTITY);

            await hArgs.exec(CrudHooks.BEFORE_COMMIT, CrudParamTypes.ENTITY);
            await em.commit();
            await hArgs.exec(CrudHooks.AFTER_COMMIT, CrudParamTypes.ENTITY);

            entity = hArgs.data[CrudParamTypes.ENTITY];
            const json = await hArgs.call(
                CrudHooks.AFTER_VIEW,
                entity.__helper
                    ? {
                          [this.options.name]: wrap(
                              hArgs.data[CrudParamTypes.ENTITY],
                          ).toPOJO(),
                      }
                    : entity,
            );

            return json as CrudGetResult<T_CrudName, T_CrudEntity, P>;
        } catch (e) {
            await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
            em.isInTransaction() && (await em.rollback());
            await hArgs.call(CrudHooks.AFTER_ROLLBACK);
            throw e;
        }
    }

    async create(data: {
        req: Express.Request;
        res: Express.Response;
        params: any;
        body: CrudDTO<T_CrudName, T_CrudEntity> | T_CrudEntity[];
        file: Express.Multer.File;
        files: Express.Multer.File[];
    }): Promise<PrimaryKeys<T_CrudEntity>> {
        const em = this.em.fork();
        await em.begin();

        const primaryKeys = this._metadata.primaryKeys;
        const entityName = this._metadata.name!;
        const hArgs = new CrudArgs(this.em, this.moduleRef, this.options, {
            [CrudParamTypes.KEYS]: primaryKeys,
            [CrudParamTypes.OPTIONS]: {},
            [CrudParamTypes.REQUEST]: data.req,
            [CrudParamTypes.RESPONSE]: data.res,
            [CrudParamTypes.PARAMS]: data.params,
            [CrudParamTypes.BODY]: data.body,
            [CrudParamTypes.FILE]: data.file,
            [CrudParamTypes.FILES]: data.files,
        });

        try {
            let entities: T_CrudEntity[] = await hArgs.exec(
                CrudHooks.BEFORE_CREATE,
                CrudParamTypes.ENTITIES,
            );
            entities = await hArgs.exec(
                CrudHooks.BEFORE_UPSERT,
                CrudParamTypes.ENTITIES,
            );
            entities = Array.isArray(entities) ? entities : [entities];

            if (entities.length === 0) {
                if (Array.isArray(data.body)) {
                    entities.push(
                        ...data.body.map((x) =>
                            em.create<T_CrudEntity>(entityName, x),
                        ),
                    );
                } else {
                    entities.push(
                        em.create<T_CrudEntity>(
                            entityName,
                            data.body[this.options.name],
                        ),
                    );
                }
            }

            hArgs.setEntity(entities);
            await hArgs.exec(CrudHooks.AFTER_CREATE, CrudParamTypes.ENTITIES);
            await hArgs.exec(CrudHooks.AFTER_UPSERT, CrudParamTypes.ENTITIES);
            await hArgs.exec(CrudHooks.BEFORE_FLUSH, CrudParamTypes.ENTITIES);

            let i = 0;
            for (const entity of entities) {
                await em.persist(
                    await hArgs.call(CrudHooks.BEFORE_PERSIST, entity),
                );
                entities[i] = await hArgs.call(
                    CrudHooks.AFTER_PERSIST,
                    entities[i],
                );
                i++;
            }
            await em.flush();

            hArgs.setEntity(entities);
            await hArgs.exec(CrudHooks.AFTER_FLUSH, CrudParamTypes.ENTITIES);

            const result: PrimaryKeys<T_CrudEntity> =
                {} as PrimaryKeys<T_CrudEntity>;

            if (entities.length === 1) {
                for (const pk of primaryKeys) {
                    result[pk] = entities[0][pk];
                }
            } else {
                for (const pk of primaryKeys) {
                    result[pk] = entities.map((x) => x[pk]);
                }
            }

            await hArgs.call(CrudHooks.BEFORE_COMMIT);
            await em.commit();
            await hArgs.call(CrudHooks.AFTER_COMMIT);

            return result;
        } catch (e) {
            await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
            em.isInTransaction() && (await em.rollback());
            await hArgs.call(CrudHooks.AFTER_ROLLBACK);

            throw e;
        }
    }

    async update(data: {
        req: Express.Request;
        res: Express.Response;
        params: PrimaryKeys<T_CrudEntity>;
        body: CrudDTO<T_CrudName, T_CrudEntity>;
        file: Express.Multer.File;
        files: Express.Multer.File[];
    }): Promise<void> {
        const em = this.em.fork();
        await em.begin();

        const primaryKeys = this._metadata.primaryKeys;
        const hArgs = new CrudArgs(em, this.moduleRef, this.options, {
            [CrudParamTypes.KEYS]: primaryKeys,
            [CrudParamTypes.REQUEST]: data.req,
            [CrudParamTypes.RESPONSE]: data.res,
            [CrudParamTypes.PARAMS]: data.params,
            [CrudParamTypes.BODY]: data.body,
            [CrudParamTypes.FILE]: data.file,
            [CrudParamTypes.FILES]: data.files,
        });

        try {
            let entity = await this.findOne(em, data);
            if (entity) {
                data = await hArgs.call(CrudHooks.BEFORE_UPDATE, data);
                data = await hArgs.call(CrudHooks.BEFORE_UPSERT, data);

                if (!data.body[this.options.name]) {
                    const availableKeys = Object.keys(data.body).join(", ");
                    const error = new Error(
                        `CRUD Update Error: "body" does not have a "${this.options.name}", "body" contains "${availableKeys}"`,
                    );
                    throw error;
                }
                const json = toPlainObject(data.body[this.options.name]);
                // assignEntity(em, entity, json);
                em.assign(entity, json, {
                    updateByPrimaryKey: false,
                    mergeObjects: true,
                });
                hArgs.setEntity(entity);
                await hArgs.exec(CrudHooks.AFTER_UPDATE, CrudParamTypes.ENTITY);
                await hArgs.exec(CrudHooks.AFTER_UPSERT, CrudParamTypes.ENTITY);

                await hArgs.exec(
                    CrudHooks.BEFORE_PERSIST,
                    CrudParamTypes.ENTITY,
                );
                em.persist(entity);
                await hArgs.exec(
                    CrudHooks.AFTER_PERSIST,
                    CrudParamTypes.ENTITY,
                );

                await hArgs.exec(CrudHooks.BEFORE_FLUSH, CrudParamTypes.ENTITY);
                await em.flush();
                await hArgs.exec(CrudHooks.AFTER_FLUSH, CrudParamTypes.ENTITY);
            }

            await hArgs.call(CrudHooks.BEFORE_COMMIT);
            await em.commit();
            await hArgs.call(CrudHooks.AFTER_COMMIT);
        } catch (e) {
            await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
            em.isInTransaction() && (await em.rollback());
            await hArgs.call(CrudHooks.AFTER_ROLLBACK);

            throw e;
        }
    }

    async delete(data: {
        req: Express.Request;
        res: Express.Response;
        params: PrimaryKeys<T_CrudEntity>;
    }): Promise<void> {
        const em = this.em.fork();
        await em.begin();

        const primaryKeys = this._metadata.primaryKeys;
        const hArgs = new CrudArgs(em, this.moduleRef, this.options, {
            [CrudParamTypes.KEYS]: primaryKeys,
            [CrudParamTypes.REQUEST]: data.req,
            [CrudParamTypes.RESPONSE]: data.res,
            [CrudParamTypes.PARAMS]: data.params,
        });

        try {
            let entity = await this.findOne(em, data);
            if (entity) {
                hArgs.setEntity(entity);
                await hArgs.exec(
                    CrudHooks.BEFORE_DELETE,
                    CrudParamTypes.ENTITY,
                );
                await em.remove<T_CrudEntity>(entity).flush();
                await hArgs.call(CrudHooks.AFTER_DELETE);
            }

            await hArgs.call(CrudHooks.BEFORE_COMMIT);
            await em.commit();
            await hArgs.call(CrudHooks.AFTER_COMMIT);
        } catch (e) {
            await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
            em.isInTransaction() && (await em.rollback());
            await hArgs.call(CrudHooks.AFTER_ROLLBACK);

            throw e;
        }
    }
}
