import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../mikro-crud.types";

export function GetQuery(name: string): MethodDecorator {
    return function (target, propertyName) {
        getMetadataStorage().on(name, {
            target,
            propertyName,
            type: CrudHooks.GET_QUERY,
        } as CrudListenerMetadataArgs);
    };
}
