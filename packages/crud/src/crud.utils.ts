import { AnyEntity, Collection, EntityManager, EntityMetadata, EntityProperty } from "@mikro-orm/core";

const _circularStack = [];

export function isArray(obj: any) {
  return obj && Array.isArray(obj);
}

export function isObject(obj: any): boolean {
  return obj && !isArray(obj) && typeof obj === "object";
}

export function isEntity(obj: any): boolean {
  return "__helper" in obj && !(obj instanceof Collection);
}

export function isBuiltInObject(obj: any): boolean {
  return obj instanceof Date || obj instanceof RegExp;
}

export function isConvertableObject(obj: any): boolean {
  return isObject(obj) && (isEntity(obj) || !isBuiltInObject(obj)) && !(obj instanceof Collection);
}

export function getProperties(obj: any): string[] {
  return obj.__helper?.__meta.props.filter((x) => !x.hidden).map((x) => x.name) || Object.keys(obj);
}

export function toPlainObject(obj: any): object {
  const ret: any = {};
  const props = getProperties(obj);

  for (const prop of props) {
    if (isConvertableObject(obj[prop])) {
      if (_circularStack.length > 0) {
        if (obj[prop].__helper && obj[prop].__helper.__em) {
          const helper = obj[prop].__helper;
          const entityName = helper.__meta.name;
          const comparator = helper.__em.comparator;
          const lastEntity = _circularStack[_circularStack.length - 1];
          const result = comparator.getEntityComparator(entityName)(obj[prop], lastEntity);

          if (Object.keys(result).length === 0) {
            continue;
          }
        }
      }

      _circularStack.push(obj[prop]);
      ret[prop] = toPlainObject(obj[prop]);
      _circularStack.pop();
    } else if (isArray(obj[prop])) {
      ret[prop] = toPlainArray(obj[prop]);
    } else if (obj[prop] !== undefined) {
      ret[prop] = obj[prop];
    }
  }

  return ret;
}

export function toPlainArray(items: any[]): any[] {
  const ret = [];

  for (const item of items) {
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

export function compareEntity(entity: any, data: any) {
  const metadata = entity.__meta as EntityMetadata;
  for (const pk of metadata.primaryKeys) {
    if (entity[pk] != data[pk]) {
      return false;
    }
  }
  return true;
}

export function pick(data: any, keys: string[]): any[] {
  const values = [];

  if (data && keys && Array.isArray(keys)) {
    for (const key of keys) {
      if (data[key]) {
        values.push(data[key]);
      }
    }
  }

  return values;
}

export async function findOrCreateEntity<T>(
  em: EntityManager,
  entityData: any,
  relation: EntityProperty<T>,
  defaultValue: any = null,
) {
  const pks = pick(entityData, relation.targetMeta.primaryKeys).filter((x) => !!x);
  let e = defaultValue || (await em.findOne(relation.targetMeta.class, pks));

  if (!e) {
    e = new relation.targetMeta.class();
  }

  return e;
}

export async function assignEntity<T extends AnyEntity<T>>(em: EntityManager, entity: T, data: any) {
  if (entity === null || typeof data !== "object") {
    return;
  }

  const metadata = entity.__meta;
  for (const key in metadata.properties) {
    const prop = metadata.properties[key];
    if (prop.reference === "scalar" && key in data) {
      entity[key] = data[key];
    }
  }

  for (const relation of metadata.relations) {
    if (!(relation.name in data)) {
      continue;
    }

    if (relation.reference === "1:1") {
      const entityData = data[relation.name];
      if (entityData !== null && !Array.isArray(entityData) && typeof entityData === "object") {
        const e = await findOrCreateEntity(em, entityData, relation, entity[relation.name]);
        await assignEntity(em, e, entityData);
        entity[relation.name] = e;
      } else {
        entity[relation.name] = em.getReference(relation.targetMeta.class, entityData, { wrapped: true }) as any;
      }
    } else if (relation.reference === "1:m" || relation.reference === "m:n") {
      const rel = data[relation.name];
      const result = [];
      if (Array.isArray(rel)) {
        for (const entityData of rel) {
          const e = await findOrCreateEntity(em, entityData, relation);
          await assignEntity(em, e, entityData);
          result.push(e);
        }

        const collection = entity[relation.name] as Collection<T>;
        collection.removeAll();
        collection.add(...result);
      }
    } else if (relation.reference === "m:1") {
      const rel = data[relation.name];
      if (typeof rel === "object") {
        const e = await findOrCreateEntity(em, rel, relation);
        await assignEntity(em, e, data[relation.name]);
        entity[relation.name] = e;
      } else {
        const e = await em.findOne(relation.targetMeta.class, rel);
        await assignEntity(em, e, data[relation.name]);
        entity[relation.name] = e;
      }
    }
  }
}
