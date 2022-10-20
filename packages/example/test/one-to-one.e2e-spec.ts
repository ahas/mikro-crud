import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { OneToOneModule } from "../src/apis/one-to-one.module";

describe("OneToOne Crud Controller (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [OneToOneModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/api/parents (GET)", () => {
    return request(app.getHttpServer()).get("/api/parents").expect(200).expect("Hello World!");
  });
});
