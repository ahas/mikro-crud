import { Collection, Entity, ManyToMany, PrimaryKey, Property } from "@mikro-orm/core";
import { ManyToManyParent } from "src/entities/many-to-many-parent";

@Entity()
export class ManyToManyChild {
  @PrimaryKey()
  childId: number;

  @Property()
  childValue: string = "child value";

  @ManyToMany(() => ManyToManyParent, (parent) => parent.children)
  parents = new Collection<ManyToManyParent>(this);
}
