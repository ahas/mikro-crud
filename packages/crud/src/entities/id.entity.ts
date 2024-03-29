import { ToNumber } from "@ahas/class-converter";
import { BaseEntity, PrimaryKey, Property } from "@mikro-orm/core";
import { Exclude } from "class-transformer";

export abstract class IdEntity<T extends { id: number }> extends BaseEntity<T, "id"> {
  @PrimaryKey()
  @ToNumber({ int: true })
  id!: number;

  @Property({ columnType: "datetime(6)", defaultRaw: "current_timestamp(6)", onCreate: () => new Date() })
  @Exclude({ toClassOnly: true })
  createdAt: Date;

  @Property({
    columnType: "datetime(6)",
    defaultRaw: "current_timestamp(6)",
    extra: "on update current_timestamp(6)",
    onUpdate: () => new Date(),
  })
  @Exclude({ toClassOnly: true })
  updatedAt: Date;
}
