import type { AutoPath } from "@mikro-orm/core/typings";
import { ModuleRef } from "@nestjs/core";
import {
  AnyEntity,
  EntityMetadata,
  FilterQuery,
  FindOneOptions,
  FindOptions,
  QueryFlag,
  QueryOrderMap,
  QueryOrder,
  EntityManager,
  LoadStrategy,
  NotFoundError,
  wrap,
} from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";
import {
  CrudDto,
  CrudHooks,
  CrudGetResult,
  CrudOptions,
  CrudSearchResult,
  PrimaryKeys,
  WhereQuery,
  RequestData,
} from "./crud.types";
import { assignEntity, toPlainObject } from "./crud.utils";
import { CrudArgs } from "./crud.args";
import { CrudParamTypes } from "./decorators";
import fs from "fs";

@Injectable()
export class CrudService<T_Name extends string, T_Entity extends AnyEntity<T_Entity>, P extends string = never> {
  private _metadata: EntityMetadata<T_Entity>;
  private _populate:
    | AutoPath<T_Entity, P>[]
    | { search?: AutoPath<T_Entity, P>[]; get?: AutoPath<T_Entity, P>[] }
    | boolean;
  options: CrudOptions<T_Name, T_Entity, P>;

  constructor(
    private readonly em: EntityManager,
    private moduleRef: ModuleRef,
    @Inject("CRUD_OPTIONS")
    options: CrudOptions<T_Name, T_Entity, P>,
  ) {
    this.options = options;
    if (options.filter) {
      this._populate = options.filter.filter((x) => String(x).indexOf(".") >= 0);
    } else {
      this._populate = options.populate || false;
    }
    this.options.filter = options.filter;
    this.options.default = this.options.default || {};
    this.options.default.offset = this.options.default.offset || 0;
    this.options.default.limit = this.options.default.limit || 300;
    this._metadata = this.em.getMetadata().find<T_Entity>(this.options.entity.name)!;
  }

  private getPopulateOption(type: "search" | "get") {
    const isArray = Array.isArray(this._populate);
    const isBoolean = typeof this._populate === "boolean";
    return isArray || isBoolean ? this._populate : this._populate[type];
  }

  private getRequestArgs(data: RequestData<T_Name, T_Entity>) {
    return {
      [CrudParamTypes.REQUEST]: data.req,
      [CrudParamTypes.RESPONSE]: data.res,
      [CrudParamTypes.PARAMS]: data.params,
      [CrudParamTypes.QUERY]: data.query,
      [CrudParamTypes.BODY]: data.body,
      [CrudParamTypes.FILE]: data.file,
      [CrudParamTypes.FILES]: data.files,
    };
  }

  async search(reqData: RequestData<T_Name, T_Entity>): Promise<CrudSearchResult<T_Entity, P>> {
    const em = this.em.fork();
    await em.begin();

    const primaryKeys = this._metadata.primaryKeys;
    const entityName = this._metadata.name!;
    const hArgs = new CrudArgs<T_Name, T_Entity, P>(em, this.moduleRef, this.options, {
      ...this.getRequestArgs(reqData),
      [CrudParamTypes.KEYS]: primaryKeys,
      [CrudParamTypes.OPTIONS]: {
        populate: this.getPopulateOption("search"),
        offset: reqData.query.offset || this.options.default.offset,
        flags: [QueryFlag.DISABLE_PAGINATE],
        strategy: LoadStrategy.SELECT_IN,
      },
    });

    try {
      const findOptions = hArgs.data[CrudParamTypes.OPTIONS] as FindOptions<T_Entity, P>;

      if (reqData.query.limit) {
        findOptions.limit = reqData.query.limit;
      } else if (this.options.default.limit !== Infinity) {
        findOptions.limit = this.options.default.limit;
      }

      if (reqData.query.sort) {
        hArgs.data[CrudParamTypes.OPTIONS].orderBy = {
          [reqData.query.sort]: reqData.query.order?.toLowerCase() === "asc" ? QueryOrder.ASC : QueryOrder.DESC,
        } as QueryOrderMap<T_Entity>;
      } else {
        hArgs.data[CrudParamTypes.OPTIONS].orderBy = {
          [this._metadata.primaryKeys[0]]: QueryOrder.DESC,
        } as QueryOrderMap<T_Entity>;
      }

      let appendix = {};
      if (this.options.filter) {
        appendix = this.options.filter.reduce((a, b) => {
          if (b in reqData.query) {
            a[b] = reqData.query[b];
          }
          return a;
        }, {} as any);
      }

      hArgs.data[CrudParamTypes.FILTER] = reqData.query.toFilter(appendix) as WhereQuery<T_Entity>;

      await hArgs.exec(CrudHooks.SEARCH_QUERY, CrudParamTypes.FILTER);
      await hArgs.exec(CrudHooks.BEFORE_SEARCH, CrudParamTypes.FILTER);
      const ret = await em.findAndCount<T_Entity, P>(
        entityName,
        hArgs.data[CrudParamTypes.FILTER] as FilterQuery<T_Entity>,
        hArgs.data[CrudParamTypes.OPTIONS] as FindOptions<T_Entity, P>,
      );
      ret[0] = await hArgs.call(CrudHooks.AFTER_SEARCH, ret[0]);

      await hArgs.call(CrudHooks.BEFORE_COMMIT);
      await em.commit();
      await hArgs.call(CrudHooks.AFTER_COMMIT);

      return {
        items: ret[0].map((x) => (x.__helper ? wrap(x).toJSON() : x)),
        count: ret[1],
      };
    } catch (e) {
      await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
      em.isInTransaction() && (await em.rollback());
      await hArgs.call(CrudHooks.AFTER_ROLLBACK);
      throw e;
    }
  }

  private async findOne(em: EntityManager, reqData: RequestData<T_Name, T_Entity>) {
    const options: FindOneOptions<T_Entity, P> = {
      populate: true,
      cache: false,
    };
    const entityName = this._metadata.name!;
    const primaryKeys = this._metadata.primaryKeys;
    const hArgs = new CrudArgs(em, this.moduleRef, this.options, {
      ...this.getRequestArgs(reqData),
      [CrudParamTypes.KEYS]: primaryKeys,
      [CrudParamTypes.OPTIONS]: options,
    });

    const where = await hArgs.exec<WhereQuery<T_Entity>>(CrudHooks.GET_QUERY, CrudParamTypes.FILTER);

    for (const pk of primaryKeys) {
      where[pk] = reqData.params[pk];
    }

    return await em.findOne<T_Entity, P>(entityName, where as FilterQuery<T_Entity>, options);
  }

  async get(reqData: RequestData<T_Name, T_Entity>): Promise<CrudGetResult<T_Name, T_Entity, P>> {
    const em = this.em.fork();
    await em.begin();

    const entityName = this._metadata.name!;
    const primaryKeys = this._metadata.primaryKeys;
    const hArgs = new CrudArgs(this.em, this.moduleRef, this.options, {
      ...this.getRequestArgs(reqData),
      [CrudParamTypes.KEYS]: primaryKeys,
      [CrudParamTypes.OPTIONS]: {
        populate: this.getPopulateOption("get"),
        cache: false,
      },
    });

    try {
      await hArgs.exec(CrudHooks.GET_QUERY, CrudParamTypes.FILTER);

      for (const pk of primaryKeys) {
        hArgs.data[CrudParamTypes.FILTER] = reqData.params[pk];
      }
      await hArgs.exec(CrudHooks.BEFORE_GET, CrudParamTypes.FILTER);

      await hArgs.exec(CrudHooks.BEFORE_VIEW, CrudParamTypes.FILTER);

      let entity = await em.findOne<T_Entity, P>(
        entityName,
        hArgs.data[CrudParamTypes.FILTER] as FilterQuery<T_Entity>,
        hArgs.data[CrudParamTypes.OPTIONS],
      );

      if (!entity) {
        throw new NotFoundError(`Entity ${this.options.name} not found.`);
      }

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
              [this.options.name]: wrap(hArgs.data[CrudParamTypes.ENTITY]).toJSON(),
            }
          : entity,
      );

      return json as CrudGetResult<T_Name, T_Entity, P>;
    } catch (e) {
      await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
      em.isInTransaction() && (await em.rollback());
      await hArgs.call(CrudHooks.AFTER_ROLLBACK);
      throw e;
    }
  }

  async create(reqData: RequestData<T_Name, T_Entity>): Promise<PrimaryKeys<T_Entity>> {
    const em = this.em.fork();
    await em.begin();

    const primaryKeys = this._metadata.primaryKeys;
    const entityName = this._metadata.name!;
    const hArgs = new CrudArgs(this.em, this.moduleRef, this.options, {
      ...this.getRequestArgs(reqData),
      [CrudParamTypes.KEYS]: primaryKeys,
      [CrudParamTypes.OPTIONS]: { populate: true },
    });

    try {
      let entities: T_Entity[] = await hArgs.exec(CrudHooks.BEFORE_CREATE, CrudParamTypes.ENTITIES);
      entities = await hArgs.exec(CrudHooks.BEFORE_UPSERT, CrudParamTypes.ENTITIES);
      entities = Array.isArray(entities) ? entities : [entities];

      if (entities.length === 0) {
        if (Array.isArray(reqData.body)) {
          entities.push(...reqData.body.map((x) => em.create<T_Entity>(entityName, x)));
        } else {
          entities.push(em.create<T_Entity>(entityName, reqData.body[this.options.name]));
        }
      }

      hArgs.setEntity(entities);
      await hArgs.exec(CrudHooks.AFTER_CREATE, CrudParamTypes.ENTITIES);
      await hArgs.exec(CrudHooks.AFTER_UPSERT, CrudParamTypes.ENTITIES);
      await hArgs.exec(CrudHooks.BEFORE_FLUSH, CrudParamTypes.ENTITIES);

      let i = 0;
      for (const entity of entities) {
        await em.persist(await hArgs.call(CrudHooks.BEFORE_PERSIST, entity));
        entities[i] = await hArgs.call(CrudHooks.AFTER_PERSIST, entities[i]);
        i++;
      }
      await em.flush();

      hArgs.setEntity(entities);
      await hArgs.exec(CrudHooks.AFTER_FLUSH, CrudParamTypes.ENTITIES);

      const result: PrimaryKeys<T_Entity> = {} as PrimaryKeys<T_Entity>;

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
      this.deleteFiles(reqData);
      em.isInTransaction() && (await em.rollback());
      await hArgs.call(CrudHooks.AFTER_ROLLBACK);

      throw e;
    }
  }

  async update(reqData: RequestData<T_Name, T_Entity>): Promise<void> {
    const em = this.em.fork();
    await em.begin();

    const primaryKeys = this._metadata.primaryKeys;
    const hArgs = new CrudArgs(em, this.moduleRef, this.options, {
      ...this.getRequestArgs(reqData),
      [CrudParamTypes.KEYS]: primaryKeys,
      [CrudParamTypes.OPTIONS]: { populate: true, cache: false },
    });

    try {
      let entity = await this.findOne(em, reqData);
      if (entity) {
        reqData = await hArgs.call(CrudHooks.BEFORE_UPDATE, reqData);
        reqData = await hArgs.call(CrudHooks.BEFORE_UPSERT, reqData);

        const body = (reqData.body as CrudDto<T_Name, T_Entity>)?.[this.options.name];

        if (!body) {
          const availableKeys = Object.keys(reqData.body).join(", ");
          const error = new Error(
            `CRUD Update Error: "body" does not have a "${this.options.name}", "body" contains "${availableKeys}"`,
          );
          throw error;
        }
        const json = toPlainObject(body);
        await assignEntity(em, entity, json);

        hArgs.setEntity(entity);
        await hArgs.exec(CrudHooks.AFTER_UPDATE, CrudParamTypes.ENTITY);
        await hArgs.exec(CrudHooks.AFTER_UPSERT, CrudParamTypes.ENTITY);

        await hArgs.exec(CrudHooks.BEFORE_PERSIST, CrudParamTypes.ENTITY);
        em.persist(entity);
        await hArgs.exec(CrudHooks.AFTER_PERSIST, CrudParamTypes.ENTITY);

        await hArgs.exec(CrudHooks.BEFORE_FLUSH, CrudParamTypes.ENTITY);
        await em.flush();
        await hArgs.exec(CrudHooks.AFTER_FLUSH, CrudParamTypes.ENTITY);
      } else {
        throw new NotFoundError(`Entity ${this.options.name} not found.`);
      }

      await hArgs.call(CrudHooks.BEFORE_COMMIT);
      await em.commit();
      await hArgs.call(CrudHooks.AFTER_COMMIT);
    } catch (e) {
      await hArgs.call(CrudHooks.BEFORE_ROLLBACK);
      this.deleteFiles(reqData);
      em.isInTransaction() && (await em.rollback());
      await hArgs.call(CrudHooks.AFTER_ROLLBACK);

      throw e;
    }
  }

  async delete(data: { req: Express.Request; res: Express.Response; params: PrimaryKeys<T_Entity> }): Promise<void> {
    const em = this.em.fork();
    await em.begin();

    const primaryKeys = this._metadata.primaryKeys;
    const hArgs = new CrudArgs(em, this.moduleRef, this.options, {
      ...this.getRequestArgs(data),
      [CrudParamTypes.KEYS]: primaryKeys,
      [CrudParamTypes.OPTIONS]: { populate: true },
    });

    try {
      let entity = await this.findOne(em, data);
      if (entity) {
        hArgs.setEntity(entity);
        await hArgs.exec(CrudHooks.BEFORE_DELETE, CrudParamTypes.ENTITY);
        await em.remove<T_Entity>(entity).flush();
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

  deleteFiles(reqData: RequestData<T_Name, T_Entity>): void {
    const files: Express.Multer.File[] = [];

    if (reqData.file) {
      files.push(reqData.file);
    }

    if (Array.isArray(reqData.files)) {
      files.push(...reqData.files);
    }

    for (const file of files) {
      if (this.options.aws.s3) {
        this.options.aws.s3.deleteObject({
          Bucket: this.options.aws.bucket,
          Key: file.key,
        });
      } else if (fs.existsSync(file.path)) {
        fs.unlinkSync(process.cwd() + file.path);
      }
    }
  }
}
