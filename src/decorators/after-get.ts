import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../mikro-crud.types";

export function AfterGet(name: string): MethodDecorator {
    return function (target, propertyName) {
        getMetadataStorage().on(name, {
            target,
            propertyName,
            type: CrudHooks.AFTER_GET,
        } as CrudListenerMetadataArgs);
    };
}
