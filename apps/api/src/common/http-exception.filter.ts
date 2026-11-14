import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: Record<string, unknown>): void;
}

interface HttpRequest {
  method: string;
  url: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponse>();
    const request = context.getRequest<HttpRequest>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const isUnexpected = !(exception instanceof HttpException);
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : undefined;
    const responseCode = responseObject?.code;

    const body: Record<string, unknown> = {
      statusCode,
      code: isUnexpected
        ? 'INTERNAL_SERVER_ERROR'
        : typeof responseCode === 'string'
          ? responseCode
          : `HTTP_${statusCode}`,
      message: isUnexpected
        ? 'An unexpected error occurred.'
        : (responseObject?.message ?? exceptionResponse ?? 'Request failed.'),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (!isUnexpected && responseObject?.details !== undefined) {
      body.details = responseObject.details;
    }

    response.status(statusCode).json(body);
  }
}
