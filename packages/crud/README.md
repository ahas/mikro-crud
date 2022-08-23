# Installation

```console
npm install @ahas/mikro-crud
# or
yarn add @ahas/mikro-crud
```

# Usage

```ts
import { Module } from "@nestjs/common";
import { CrudModule } from "@ahas/mikro-crud";

@Module({
    CrudModule.forFeature({
        entity: User,
        path: "users",
        name: "user",
    })
})
export class UserApiModule {}
```

# Controller

### CrudModule will generate 5 crud endpoints automatically.

|HTTP Method|Request URL   |Controller method|
|-----------|--------------|-----------------|
|GET        |/api/users/   |search           |
|GET        |/api/users/:id|get              |
|POST       |/api/users    |create           |
|PATCH      |/api/users/:id|update           |
|DELETE     |/api/users/:id|delete           |

# Request body and response

## search
### [GET] /api/users
Response
```json
{
    items: [
        {
            id: 1,
            nickname: "ahas"
        }
    ],
    count: 0
}
```

## get
### [GET] /api/users/1
Response
```json
{
    user: {
        id: 1,
        nickname: "ahas"
    }
}
```

## create
### [POST] /api/users
Request body
```json
{
    user: {
        nickname: "alchemist"
    }
}
```
Response
```json
{
    id: 2
}
```

## update
### [PATCH] /api/users/2
Request body
```json
{
    user: {
        nickname: "goto"
    }
}
```