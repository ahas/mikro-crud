import { CrudModule } from "@ahas/mikro-crud";
import { Module } from "@nestjs/common";
import { ManyToManyChild } from "src/entities/many-to-many-child";
import { ManyToManyParent } from "src/entities/many-to-many-parent";

const parentCrud = CrudModule.forFeature({
  entity: ManyToManyParent,
  name: "parent",
  path: "parents",
  primaryKeys: ["parentId"],
});

const childCrud = CrudModule.forFeature({
  entity: ManyToManyChild,
  name: "child",
  path: "children",
  primaryKeys: ["childId"],
});

@Module({
  imports: [parentCrud, childCrud],
})
export class ManyToManyModule {}
