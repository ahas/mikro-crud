import type { AnyEntity } from "@mikro-orm/core";
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
  Res,
  Type,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { CrudErrorInterceptor } from "./crud.exceptions";
import { CrudService } from "./crud.service";
import joinUrl from "@ahas/join-url";
import { plainToInstance } from "class-transformer";
import { ApiBody, ApiOperation, ApiParam } from "@nestjs/swagger";
import { CrudGetResult, CrudSearchQuery, CrudDTO, CrudOptions, PrimaryKeys } from "./crud.types";
import { Request, Response } from "express";

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
    constructor(private readonly crudService: CrudService<T_CrudName, T_CrudEntity, P>) {}

    @Get(CRUD_URL)
    @ApiOperation({
      operationId: options.entity.name + "Controller_search",
    })
    async search(
      @Req() req: Request,
      @Res({ passthrough: true }) res: Response,
      @Query() query: CrudSearchQuery<T_CrudEntity>,
      @Param() params,
    ) {
      query = plainToInstance(CrudSearchQuery, query) as CrudSearchQuery<T_CrudEntity>;
      query.options = this.crudService.options;

      return await this.crudService.search({
        req,
        res,
        query,
        params,
      });
    }

    @Get(CRUD_URL_WITH_KEYS)
    @ApiOperation({ operationId: options.entity.name + "Controller_get" })
    @UseInterceptors(new CrudErrorInterceptor())
    async get(
      @Req() req,
      @Res({ passthrough: true }) res,
      @Query() query,
      @Param() params: PrimaryKeys<T_CrudEntity>,
    ): Promise<CrudGetResult<T_CrudName, T_CrudEntity, P>> {
      return await this.crudService.get({
        req,
        res,
        query,
        params,
      });
    }

    @Post(CRUD_URL)
    @HttpCode(201)
    @ApiOperation({
      operationId: options.entity.name + "Controller_create",
    })
    async create(
      @Req() req,
      @Res({ passthrough: true }) res,
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
        res,
        params,
        body,
        file,
        files,
      });
    }

    @Patch(CRUD_URL_WITH_KEYS)
    @UseInterceptors(new CrudErrorInterceptor())
    @ApiOperation({
      operationId: options.entity.name + "Controller_update",
    })
    async update(
      @Req() req,
      @Res({ passthrough: true }) res,
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
        res,
        params,
        body,
        file,
        files,
      });
    }

    @Delete(CRUD_URL_WITH_KEYS)
    @UseInterceptors(new CrudErrorInterceptor())
    @ApiOperation({
      operationId: options.entity.name + "Controller_delete",
    })
    async delete(
      @Req() req,
      @Res({ passthrough: true }) res,
      @Param() params: PrimaryKeys<T_CrudEntity>,
    ): Promise<void> {
      return await this.crudService.delete({
        req,
        res,
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
