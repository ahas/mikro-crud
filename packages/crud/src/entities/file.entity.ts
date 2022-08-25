import fs from "fs";
import { extname, join, relative, resolve } from "path";
import { AfterDelete, BeforeDelete, Collection, Entity, EntityManager, Property } from "@mikro-orm/core";
import { ToNumber, ToString } from "@ahas/class-converter";
import { IdEntity } from "./id.entity";
import { CrudModule } from "../crud.module";

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        acl: string;
        key: string;
        storageClass: string;
        location: string;
        bucket: string;
      }
    }
  }
}

@Entity({ abstract: true })
export abstract class File extends IdEntity {
  // File API
  @Property()
  @ToString()
  name: string;

  @Property()
  @ToString()
  mimeType: string;

  @Property()
  @ToNumber()
  size: number;

  // Server API
  @Property({ nullable: true })
  @ToString({ optional: true })
  localName: string;

  @Property()
  @ToString({ optional: true })
  public: string;

  @Property({ nullable: true })
  @ToString({ optional: true })
  dir: string;

  @Property({ nullable: true })
  @ToString({ optional: true })
  path: string;

  @Property({ nullable: true })
  @ToString({ optional: true })
  ext: string;

  @Property({ nullable: true })
  @ToString({ optional: true })
  acl: string;

  @Property({ nullable: true })
  @ToString({ optional: true })
  bucket: string;

  @Property({ nullable: true })
  @ToString({ optional: true })
  storageClass: string;

  @Property({ nullable: true })
  @ToString({ optional: true })
  key: string;

  static createEntity(em: EntityManager, file: Express.Multer.File): File {
    const entity = em.create(this, {});
    entity.name = file.originalname;
    entity.mimeType = file.mimetype;
    entity.size = file.size;
    entity.localName = file.filename;
    entity.public = file.location || join("/", relative("www", file.path)).replace(/\\/g, "/");
    entity.dir = file.destination;
    entity.path = file.path;
    entity.ext = extname(file.originalname);
    entity.key = file.key || entity.localName;
    entity.bucket = file.bucket;

    return entity;
  }

  static upload(em: EntityManager, target: any, file: Express.Multer.File): File[];
  static upload(em: EntityManager, target: any, files: Express.Multer.File[]): File[];
  static upload(em: EntityManager, target: any, arg: Express.Multer.File | Express.Multer.File[]): File[] {
    if (Array.isArray(arg)) {
      return this.uploadAll(em, target, arg);
    } else if (arg) {
      return [this.uploadOne(em, target, arg)];
    }

    return [];
  }

  static uploadAll(em: EntityManager, target: any, arg: Express.Multer.File[]): File[] {
    const result: File[] = [];

    for (const file of arg) {
      const entity = this.uploadOne(em, target, file);

      result.push(entity);
    }

    return result;
  }

  static uploadOne(em: EntityManager, target: any, file: Express.Multer.File): File {
    const entity = this.createEntity(em, file);
    const { field, index } = parseField(target, file.fieldname);

    if (Array.isArray(field)) {
      field.push(entity);
    } else if (field instanceof Collection) {
      field.add(entity);
    } else {
      field[index] = entity;
    }

    return entity;
  }

  @BeforeDelete()
  @AfterDelete()
  delete() {
    return File.delete(this);
  }

  static delete(...files: File[]) {
    for (const file of files) {
      if (file.path) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(resolve(process.cwd(), file.path));
        }
      } else if (file.bucket && CrudModule.s3.has(file.bucket)) {
        CrudModule.s3.get(file.bucket).deleteObject({
          Bucket: file.bucket,
          Key: file.key,
        });
      }
    }
  }
}

function getFieldPaths(fieldname: string): string[] {
  return fieldname.replace("[", ".").replaceAll("][", ".").replaceAll("]", "").split(".");
}

function parseField(data: any, fieldname: string): any {
  const paths = getFieldPaths(fieldname);
  let field = data;

  for (let i = 0; i < paths.length - 1; i++) {
    if (!field[paths[i]]) {
      field[paths[i]] = {};
    }
    field = field[paths[i]];
  }

  return { field, paths, index: paths[paths.length - 1] };
}
