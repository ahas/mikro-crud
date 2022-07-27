import { ModuleRef } from "@nestjs/core";
import { CrudHooks, CrudListenerMetadataArgs } from "./crud.types";
import { CrudParamTypes, CRUD_ARGS_METADATA } from "./decorators";

export function getMetadataStorage(): MetadataStorage {
    if (!global.crudMetadataStorage) {
        global.crudMetadataStorage = new MetadataStorage();
    }
    return global.crudMetadataStorage;
}

export class MetadataStorage {
    readonly listeners: Map<string, CrudListenerMetadataArgs[]>;

    constructor() {
        this.listeners = new Map<string, CrudListenerMetadataArgs[]>();
    }

    on(name: string, args: CrudListenerMetadataArgs): this {
        if (!this.listeners.has(name)) {
            this.listeners.set(name, []);
        }

        this.listeners.get(name)?.push(args);

        return this;
    }

    emit<T>(
        moduleRef: ModuleRef,
        name: string,
        type: CrudHooks,
        params: { [key in CrudParamTypes]?: any },
    ): T | undefined {
        let returnValue: T | undefined;

        this.listeners.get(name)?.forEach((x) => {
            if (x.type === type) {
                const metadata = Reflect.getMetadata(
                    CRUD_ARGS_METADATA,
                    x.target.constructor,
                    x.propertyName,
                );
                const args: any[] = [];
                for (const key in metadata) {
                    const m = metadata[key];
                    args[m.index] = params[m.type];
                }
                const hook = x.target[x.propertyName];
                const service = moduleRef.get(x.target.constructor, {
                    strict: false,
                });

                returnValue = hook.apply(service, args) || returnValue;
            }
        });

        return returnValue;
    }

    get(name: string): CrudListenerMetadataArgs[] {
        return this.listeners.get(name);
    }
}
