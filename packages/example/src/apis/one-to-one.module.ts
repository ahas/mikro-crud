import { CrudModule } from "@ahas/mikro-crud";
import { Module } from "@nestjs/common";
import { OneToOneChild } from "src/entities/one-to-one-child";
import { OneToOneParent } from "src/entities/one-to-one-parent";

const parentCrud = CrudModule.forFeature({
  entity: OneToOneParent,
  name: "parent",
  path: "parents",
  primaryKeys: ["parentId"],
});

const childCrud = CrudModule.forFeature({
  entity: OneToOneChild,
  name: "child",
  path: "children",
  primaryKeys: ["childId"],
});

@Module({
  imports: [parentCrud, childCrud],
})
export class OneToOneModule {}
