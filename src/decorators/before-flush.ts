import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../crud.types";

export function BeforeFlush(name: string): MethodDecorator {
    return function(target, propertyName) {
        getMetadataStorage().on(name, {
            target,
            propertyName,
            type: CrudHooks.BEFORE_FLUSH,
        } as CrudListenerMetadataArgs);
    };
}
