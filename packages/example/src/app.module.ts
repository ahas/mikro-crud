import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CrudModule } from "@ahas/mikro-crud";
import { OneToOneParent } from "src/entities/one-to-one-parent";
import { MikroORM } from "@mikro-orm/core";
import { OneToOneChild } from "src/entities/one-to-one-child";

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
  imports: [
    MikroOrmModule.forRoot({
      dbName: ":memory:",
      type: "sqlite",
      entities: ["./dist/entities/**/*.js"],
      entitiesTs: ["./src/entities/**/*.ts"],
      cache: { enabled: true, pretty: true },
    }),
    parentCrud,
    childCrud,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(private readonly orm: MikroORM) {
    this.initDatabase();
  }

  async initDatabase() {
    const generator = this.orm.getSchemaGenerator();
    await generator.updateSchema();
  }
}
