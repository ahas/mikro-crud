import { Collection, Entity, OneToMany, PrimaryKey, Property } from "@mikro-orm/core";
import { ManyToOneChild } from "src/entities/many-to-one-child";

@Entity()
export class OneToManyParent {
  @PrimaryKey()
  parentId: number;

  @Property()
  parentValue: string = "parent value";

  @OneToMany(() => ManyToOneChild, (child) => child.parent, {
    eager: true,
    nullable: true,
    orphanRemoval: true,
  })
  children = new Collection<ManyToOneChild>(this);
}
