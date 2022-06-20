import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../crud.types";

export function AfterFlush(name: string): MethodDecorator {
    return function(target, propertyName) {
        getMetadataStorage().on(name, {
            target,
            propertyName,
            type: CrudHooks.AFTER_FLUSH,
        } as CrudListenerMetadataArgs);
    };
}
