import { AnyEntity, MikroORM } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/core";
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
    Req,
    Type,
    UploadedFile,
    UploadedFiles,
} from "@nestjs/common";
import { CrudService, PrimaryKeys } from "./crud.service";
import { CrudGetResult, CrudSearchQuery, CrudDTO, CrudOptions } from "./crud.types";
import joinUrl from "@ahas/join-url";
import { plainToInstance } from "class-transformer";
import { ApiBody, ApiOperation, ApiParam } from "@nestjs/swagger";

export interface ICrudController<
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never,
> {
    search(...args: any[]);
    get(...args: any[]): Promise<CrudGetResult<T_CrudName, T_CrudEntity, P>>;
    create(...args: any[]): Promise<PrimaryKeys<T_CrudEntity>>;
    update(...args: any[]): Promise<void>;
    delete(...args: any[]): Promise<void>;
}

export function getCrudControllerClass<
    T_CreateDTO extends CrudDTO<T_CrudName, T_CrudEntity>,
    T_UpdateDTO extends CrudDTO<T_CrudName, T_CrudEntity>,
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never,
>(options: CrudOptions<T_CrudName, T_CrudEntity, P>): Type<ICrudController<T_CrudName, T_CrudEntity>> {
    options.prefix = options.prefix || "/api";
    options.primaryKeys = options.primaryKeys || (["id"] as any);

    const KEY_PARAMS = options.primaryKeys.length == 1 ? "/:" + options.primaryKeys[0] : options.primaryKeys.join("/:");
    const CRUD_URL = options.path || options.name;
    let CRUD_URL_WITH_KEYS = joinUrl(CRUD_URL, KEY_PARAMS);
    while (CRUD_URL_WITH_KEYS.startsWith("/")) {
        CRUD_URL_WITH_KEYS = CRUD_URL_WITH_KEYS.substring(1);
    }

    @Controller(options.prefix)
    class CrudController implements ICrudController<T_CrudName, T_CrudEntity, P> {
        constructor(
            private readonly crudService: CrudService<T_CrudName, T_CrudEntity, P>,
            private readonly orm: MikroORM,
            private readonly em: EntityManager,
        ) {}

        @Get(CRUD_URL)
        @ApiOperation({ operationId: options.entity.name + "Controller_search" })
        async search(@Req() req, @Query() query: CrudSearchQuery<T_CrudEntity>, @Param() params) {
            return await this.crudService.search({
                req,
                query,
                params,
            });
        }

        @Get(CRUD_URL_WITH_KEYS)
        @ApiOperation({ operationId: options.entity.name + "Controller_get" })
        async get(
            @Req() req,
            @Query() query,
            @Param() params: PrimaryKeys<T_CrudEntity>,
        ): Promise<CrudGetResult<T_CrudName, T_CrudEntity, P>> {
            return await this.crudService.get({
                req,
                query,
                params,
            });
        }

        @Post(CRUD_URL)
        @HttpCode(201)
        @ApiOperation({ operationId: options.entity.name + "Controller_create" })
        async create(
            @Req() req,
            @Param() params: any,
            @Body() body: T_CreateDTO,
            @UploadedFile() file,
            @UploadedFiles() files,
        ): Promise<PrimaryKeys<T_CrudEntity>> {
            if (options.dto?.create) {
                body = plainToInstance(options.dto.create, body);
            }

            return await this.crudService.create({
                req,
                params,
                body,
                file,
                files,
            });
        }

        @Patch(CRUD_URL_WITH_KEYS)
        @ApiOperation({ operationId: options.entity.name + "Controller_update" })
        async update(
            @Req() req,
            @Param() params: PrimaryKeys<T_CrudEntity>,
            @Body() body: T_UpdateDTO,
            @UploadedFile() file,
            @UploadedFiles() files,
        ): Promise<void> {
            if (options.dto?.update) {
                body = plainToInstance(options.dto.update, body);
            }
            return await this.crudService.update({
                req,
                params,
                body,
                file,
                files,
            });
        }

        @Delete(CRUD_URL_WITH_KEYS)
        @ApiOperation({ operationId: options.entity.name + "Controller_delete" })
        async delete(@Req() req, @Param() params: PrimaryKeys<T_CrudEntity>): Promise<void> {
            return await this.crudService.delete({
                req,
                params,
            });
        }
    }

    if (options.dto?.create) {
        ApiBody({ type: options.dto.create })(CrudController.prototype, "create", {
            value: CrudController.prototype.create,
            writable: true,
            enumerable: false,
            configurable: true,
        });
    }
    if (options.dto?.update) {
        ApiBody({ type: options.dto.update })(CrudController.prototype, "update", {
            value: CrudController.prototype.update,
            writable: true,
            enumerable: false,
            configurable: true,
        });
    }

    for (const pk of options.primaryKeys) {
        ApiParam({ name: pk })(CrudController.prototype, "get", {
            value: CrudController.prototype.get,
            writable: true,
            enumerable: false,
            configurable: true,
        });
        ApiParam({ name: pk })(CrudController.prototype, "update", {
            value: CrudController.prototype.update,
            writable: true,
            enumerable: false,
            configurable: true,
        });
        ApiParam({ name: pk })(CrudController.prototype, "delete", {
            value: CrudController.prototype.delete,
            writable: true,
            enumerable: false,
            configurable: true,
        });
    }

    return CrudController as any;
}
