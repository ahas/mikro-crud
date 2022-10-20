import { CrudModule } from "@ahas/mikro-crud";
import { Module } from "@nestjs/common";
import { ManyToOneChild } from "src/entities/many-to-one-child";
import { OneToManyParent } from "src/entities/one-to-many-parent";

const parentCrud = CrudModule.forFeature({
  entity: OneToManyParent,
  name: "parent",
  path: "parents",
  primaryKeys: ["parentId"],
});

const childCrud = CrudModule.forFeature({
  entity: ManyToOneChild,
  name: "child",
  path: "children",
  primaryKeys: ["childId"],
});

@Module({
  imports: [parentCrud, childCrud],
})
export class OneToManyModule {}
