import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { OneToManyParent } from "src/entities/one-to-many-parent";

@Entity()
export class ManyToOneChild {
  @PrimaryKey()
  childId: number;

  @Property()
  childValue: string = "child value";

  @ManyToOne(() => OneToManyParent)
  parent: OneToManyParent;
}
