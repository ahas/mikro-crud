import { Entity, OneToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { OneToOneChild } from "./one-to-one-child";

@Entity()
export class OneToOneParent {
  @PrimaryKey()
  parentId: number;

  @Property()
  parentValue: string = "parent value";

  @OneToOne(() => OneToOneChild, (child) => child.parent, {
    eager: true,
    owner: true,
    nullable: true,
    orphanRemoval: true,
  })
  child?: OneToOneChild;
}
