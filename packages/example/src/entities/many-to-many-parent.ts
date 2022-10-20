import { Collection, Entity, ManyToMany, PrimaryKey, Property } from "@mikro-orm/core";
import { ManyToManyChild } from "src/entities/many-to-many-child";

@Entity()
export class ManyToManyParent {
  @PrimaryKey()
  parentId: number;

  @Property()
  parentValue: string = "parent value";

  @ManyToMany(() => ManyToManyChild, "parents", { owner: true })
  children = new Collection<ManyToManyChild>(this);
}
