import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../crud.types";

export function BeforeCommit(name: string): MethodDecorator {
  return function (target, propertyName) {
    getMetadataStorage().on(name, {
      target,
      propertyName,
      type: CrudHooks.BEFORE_COMMIT,
    } as CrudListenerMetadataArgs);
  };
}
