import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { MikroORM } from "@mikro-orm/core";
import { OneToOneModule } from "src/apis/one-to-one.module";
import { OneToManyModule } from "src/apis/one-to-many.module";
import { ManyToManyModule } from "src/apis/many-to-many.module";

@Module({
  imports: [
    MikroOrmModule.forRoot({
      dbName: ":memory:",
      type: "sqlite",
      entities: ["./dist/entities/**/*.js"],
      entitiesTs: ["./src/entities/**/*.ts"],
      cache: { enabled: true, pretty: true },
    }),
    OneToOneModule,
    OneToManyModule,
    ManyToManyModule,
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
