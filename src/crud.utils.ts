import { Collection, Connection, EntityManager, EntityMetadata, IDatabaseDriver } from "@mikro-orm/core";

export function isArray(obj: any) {
    return obj && (Array.isArray(obj) || obj instanceof Collection);
}

export function isObject(obj: any): boolean {
    return obj && !isArray(obj) && typeof obj === "object";
}

export function isEntity(obj: any): boolean {
    return "__helper" in obj;
}

export function isBuiltInObject(obj: any): boolean {
    return obj instanceof Date;
}

export function getItems(obj: any): any[] {
    if (obj) {
        return obj instanceof Collection ? obj.getItems() : obj;
    }
    return [];
}

export function isConvertableObject(obj: any): boolean {
    return isObject(obj) && (isEntity(obj) || !isBuiltInObject(obj));
}

export function getProperties(obj: any): string[] {
    return obj.__helper?.__meta.props.filter((x) => !x.hidden).map((x) => x.name) || Object.keys(obj);
}

export function toPlainObject(obj: any): object {
    const ret: any = {};
    const props = getProperties(obj);

    for (const prop of props) {
        if (isConvertableObject(obj[prop])) {
            ret[prop] = toPlainObject(obj[prop]);
        } else if (isArray(obj[prop])) {
            ret[prop] = toPlainArray(obj[prop]);
        } else if (obj[prop] !== undefined) {
            ret[prop] = obj[prop];
        }
    }

    return ret;
}

export function toPlainArray(arr: any): any[] {
    const ret = [];

    for (const item of getItems(arr)) {
        if (isConvertableObject(item)) {
            ret.push(toPlainObject(item));
        } else if (isArray(item)) {
            ret.push(toPlainArray(item));
        } else if (item !== undefined) {
            ret.push(item);
        }
    }

    return ret;
}

export function assignEntity(em: EntityManager<IDatabaseDriver<Connection>>, target: any, data: any) {
    for (const prop in data) {
        if (isConvertableObject(target[prop])) {
            assignEntity(em, target[prop], data[prop]);
        } else if (target[prop] instanceof Collection) {
            assignCollection(em, target, data, prop);
        } else {
            target[prop] = data[prop];
        }
    }
}

export function assignCollection(em: EntityManager<IDatabaseDriver<Connection>>, target: any, data: any[], prop: string) {
    const collection: Collection<any> = target[prop];
    let i = 0;
    for (const item of data[prop]) {
        if (!collection[i]) {
            const newItem = em.create(collection.property.entity(), item);
            collection.add(newItem);
            i++;
            continue;
        }

        const entity = pickEntity(collection, item);
        if (item._deleted) {
            em.remove(entity);
            i++;
            continue;
        }
        if (entity) {
            assignEntity(em, collection[i], item);
        }
        i++;
    }

    i = 0;
    for (const item of collection) {
        const entity = data[prop].find((x) => compareEntity(item, x));
        if (!entity) {
            collection.remove(item);
            // collection[i] = undefined;
        }
        i++;
    }
}

export function pickEntity(collection: Collection<any>, data: any): any | null {
    for (const item of collection) {
        const metadata = item.__meta as EntityMetadata;
        for (const pk of metadata.primaryKeys) {
            if (item[pk] != data[pk]) {
                break;
            }
            return item;
        }
    }

    return null;
}

export function compareEntity(entity: any, data: any) {
    const metadata = entity.__meta as EntityMetadata;
    for (const pk of metadata.primaryKeys) {
        if (entity[pk] != data[pk]) {
            return false;
        }
    }
    return true;
}
