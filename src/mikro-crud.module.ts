import { AnyEntity } from "@mikro-orm/core";
import { DynamicModule, Module } from "@nestjs/common";
import { getCrudControllerClass } from "./mikro-crud.controller";
import { MikroCrudService } from "./mikro-crud.service";
import { CrudDTO, CrudOptions } from "./mikro-crud.types";

const CRUD_CONTROLLER_METHODS = ["search", "get", "create", "update", "delete"] as const;
type CrudControllerMethods = "all" | typeof CRUD_CONTROLLER_METHODS[number];

type DynamicCrudModule<
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never,
> = DynamicModule & {
    decorate(
        propertyName: CrudControllerMethods,
        decorator: (...args: any[]) => MethodDecorator,
        ...decoratorArgs: any[]
    ): void;
};

@Module({})
export class MikroCrudModule {
    static forFeature<
        T_CreateDTO extends CrudDTO<T_CrudName, T_CrudEntity>,
        T_UpdateDTO extends CrudDTO<T_CrudName, T_CrudEntity>,
        T_CrudName extends string,
        T_CrudEntity extends AnyEntity<T_CrudEntity>,
        P extends string = never,
    >(
        options: CrudOptions<T_CrudName, T_CrudEntity, P, T_CreateDTO, T_UpdateDTO>,
    ): DynamicCrudModule<T_CrudName, T_CrudEntity, P> {
        options.prefix = options.prefix || "/api";
        options.path = options.path || options.name;

        const controller = getCrudControllerClass<T_CreateDTO, T_UpdateDTO, T_CrudName, T_CrudEntity, P>(options);

        return {
            module: MikroCrudModule,
            providers: [
                {
                    provide: "CRUD_OPTIONS",
                    useValue: options,
                },
                MikroCrudService,
            ],
            controllers: [controller],
            exports: [MikroCrudService],
            decorate(
                propertyName: CrudControllerMethods,
                decorator: (...args: any[]) => MethodDecorator,
                ...decoratorArgs: any[]
            ): void {
                if (propertyName !== "all") {
                    decorator(...decoratorArgs)(controller.prototype, propertyName, {
                        value: controller.prototype[propertyName],
                        writable: true,
                        enumerable: false,
                        configurable: true,
                    });
                } else {
                    for (const prop of CRUD_CONTROLLER_METHODS) {
                        this.decorate(prop, decorator, ...decoratorArgs);
                    }
                }
            },
        };
    }
}
