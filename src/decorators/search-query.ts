import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../mikro-crud.types";

export function SearchQuery(name: string): MethodDecorator {
    return function (target, propertyName) {
        getMetadataStorage().on(name, {
            target,
            propertyName,
            type: CrudHooks.SEARCH_QUERY,
        } as CrudListenerMetadataArgs);
    };
}
