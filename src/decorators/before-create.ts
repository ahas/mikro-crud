import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../crud.types";

export function BeforeCreate(name: string): MethodDecorator {
    return function (target, propertyName) {
        getMetadataStorage().on(name, {
            target,
            propertyName,
            type: CrudHooks.BEFORE_CREATE,
        } as CrudListenerMetadataArgs);
    };
}
