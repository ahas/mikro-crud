import { getMetadataStorage } from "../metadata-storage";
import { CrudHooks, CrudListenerMetadataArgs } from "../crud.types";

export function AfterRollback(name: string): MethodDecorator {
  return function (target, propertyName) {
    getMetadataStorage().on(name, {
      target,
      propertyName,
      type: CrudHooks.AFTER_ROLLBACK,
    } as CrudListenerMetadataArgs);
  };
}
