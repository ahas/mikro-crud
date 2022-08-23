import type { AnyEntity } from "@mikro-orm/core";
import { DynamicModule, Module } from "@nestjs/common";
import { getCrudControllerClass } from "./crud.controller";
import { CrudService } from "./crud.service";
import { CrudDto, CrudOptions } from "./crud.types";
import type { S3 } from "aws-sdk";

const CRUD_CONTROLLER_METHODS = ["search", "get", "create", "update", "upsert", "delete"] as const;
type CrudControllerMethods = "all" | typeof CRUD_CONTROLLER_METHODS[number];

type DynamicCrudModule<
  T_Name extends string,
  T_Entity extends AnyEntity<T_Entity>,
  P extends string = never,
> = DynamicModule & {
  decorate(
    propertyName: CrudControllerMethods,
    decorator: (...args: any[]) => MethodDecorator,
    ...decoratorArgs: any[]
  ): DynamicCrudModule<T_Name, T_Entity, P>;
};

@Module({})
export class CrudModule {
  static s3: Map<string, S3> = new Map<string, S3>();

  static forFeature<
    T_CreateDto extends CrudDto<T_Name, T_Entity>,
    T_UpdateDto extends CrudDto<T_Name, T_Entity>,
    T_Name extends string,
    T_Entity extends AnyEntity<T_Entity>,
    P extends string = never,
  >(options: CrudOptions<T_Name, T_Entity, P, T_CreateDto, T_UpdateDto>): DynamicCrudModule<T_Name, T_Entity, P> {
    options.prefix = options.prefix || "/api";
    options.path = options.path || options.name;

    if (options.aws) {
      this.s3.set(options.aws.bucket, options.aws.s3);
    }

    const controller = getCrudControllerClass<T_CreateDto, T_UpdateDto, T_Name, T_Entity, P>(options);
    const defaultDecoratorOptions = {
      writable: true,
      enumerable: false,
      configurable: true,
    };

    return {
      module: CrudModule,
      providers: [{ provide: "CRUD_OPTIONS", useValue: options }, CrudService],
      controllers: [controller],
      exports: [CrudService],
      decorate(propertyName: CrudControllerMethods, decorator: (...args: any[]) => MethodDecorator) {
        if (propertyName !== "all") {
          if (propertyName == "upsert") {
            decorator(controller.prototype, propertyName, {
              value: controller.prototype.create,
              ...defaultDecoratorOptions,
            });
            decorator(controller.prototype, propertyName, {
              value: controller.prototype.update,
              ...defaultDecoratorOptions,
            });
          } else {
            decorator(controller.prototype, propertyName, {
              value: controller.prototype[propertyName],
              ...defaultDecoratorOptions,
            });
          }
        } else {
          for (const prop of CRUD_CONTROLLER_METHODS) {
            this.decorate(prop, decorator);
          }
        }
        return this;
      },
    };
  }
}
