import { Entity, OneToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { OneToOneParent } from "src/entities/one-to-one-parent";

@Entity()
export class OneToOneChild {
  @PrimaryKey()
  childId: number;

  @Property()
  childValue: string = "child value";

  @OneToOne(() => OneToOneParent, (parent) => parent.child)
  parent: OneToOneParent;
}
