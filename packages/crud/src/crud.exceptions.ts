import { NotFoundError, UniqueConstraintViolationException } from "@mikro-orm/core";
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, HttpException, HttpStatus } from "@nestjs/common";
import { Observable } from "rxjs";
import { catchError } from "rxjs/operators";

@Injectable()
export class CrudErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        let status: HttpStatus;

        if (error instanceof NotFoundError) {
          status = HttpStatus.NOT_FOUND;
        } else if (error instanceof UniqueConstraintViolationException) {
          status = HttpStatus.CONFLICT;
        } else {
          status = HttpStatus.BAD_REQUEST;
        }

        throw new HttpException("", status);
      }),
    );
  }
}
