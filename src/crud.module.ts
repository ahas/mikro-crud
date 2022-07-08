import { AnyEntity } from "@mikro-orm/core";
import { DynamicModule, Module } from "@nestjs/common";
import { getCrudControllerClass } from "./crud.controller";
import { CrudService } from "./crud.service";
import { CrudDTO, CrudOptions } from "./crud.types";

const CRUD_CONTROLLER_METHODS = [
    "search",
    "get",
    "create",
    "update",
    "delete",
] as const;
type CrudControllerMethods = "all" | typeof CRUD_CONTROLLER_METHODS[number];

type DynamicCrudModule<
    T_CrudName extends string,
    T_CrudEntity extends AnyEntity<T_CrudEntity>,
    P extends string = never
> = DynamicModule & {
    decorate(
        propertyName: CrudControllerMethods,
        decorator: (...args: any[]) => MethodDecorator,
        ...decoratorArgs: any[]
    ): DynamicCrudModule<T_CrudName, T_CrudEntity, P>;
};

@Module({})
export class CrudModule {
    static forFeature<
        T_CreateDTO extends CrudDTO<T_CrudName, T_CrudEntity>,
        T_UpdateDTO extends CrudDTO<T_CrudName, T_CrudEntity>,
        T_CrudName extends string,
        T_CrudEntity extends AnyEntity<T_CrudEntity>,
        P extends string = never
    >(
        options: CrudOptions<
            T_CrudName,
            T_CrudEntity,
            P,
            T_CreateDTO,
            T_UpdateDTO
        >,
    ): DynamicCrudModule<T_CrudName, T_CrudEntity, P> {
        options.prefix = options.prefix || "/api";
        options.path = options.path || options.name;

        const controller = getCrudControllerClass<
            T_CreateDTO,
            T_UpdateDTO,
            T_CrudName,
            T_CrudEntity,
            P
        >(options);

        return {
            module: CrudModule,
            providers: [
                {
                    provide: "CRUD_OPTIONS",
                    useValue: options,
                },
                CrudService,
            ],
            controllers: [controller],
            exports: [CrudService],
            decorate(
                propertyName: CrudControllerMethods,
                decorator: (...args: any[]) => MethodDecorator,
                ...decoratorArgs: any[]
            ) {
                if (propertyName !== "all") {
                    decorator(...decoratorArgs)(
                        controller.prototype,
                        propertyName,
                        {
                            value: controller.prototype[propertyName],
                            writable: true,
                            enumerable: false,
                            configurable: true,
                        },
                    );
                } else {
                    for (const prop of CRUD_CONTROLLER_METHODS) {
                        this.decorate(prop, decorator, ...decoratorArgs);
                    }
                }
                return this;
            },
        };
    }
}
