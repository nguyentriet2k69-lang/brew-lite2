import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentAttemptStatus, PaymentMethod } from './payment-attempt.entity';
import { PaymentDetailResponse, PaymentResponse, PaymentsService } from './payments.service';

class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' }) paymentAttemptId: string;
  @ApiProperty({ format: 'uuid' }) orderId: string;
  @ApiProperty({ format: 'uuid' }) reservationId: string;
  @ApiProperty({ enum: PaymentAttemptStatus }) status: PaymentAttemptStatus;
  @ApiProperty({ enum: PaymentMethod }) method: PaymentMethod;
  @ApiProperty({ type: Number, example: 92000 }) amount: number;
  @ApiProperty({ enum: ['VND'], example: 'VND' }) currency: 'VND';
  @ApiProperty({ nullable: true }) gatewayReference: string | null;
  @ApiProperty({ nullable: true, example: 'MOCK_DECLINED' }) failureCode: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time', nullable: true }) completedAt: Date | null;
  @ApiProperty({ enum: ['PENDING', 'PAID', 'PAYMENT_FAILED', 'CANCELLED'] }) orderStatus: string;
}

class PaymentDetailResponseDto extends PaymentResponseDto {
  @ApiProperty({ enum: ['HELD', 'PAYMENT_PENDING', 'CONSUMED', 'RELEASED', 'EXPIRED'] }) reservationStatus: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or reconcile a mock payment for an Order' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Retry this exact key for processing or unknown payment outcomes.' })
  @ApiOkResponse({ type: PaymentResponseDto, description: 'Terminal SUCCESS or FAILED outcome.' })
  @ApiAcceptedResponse({ type: PaymentResponseDto, description: 'Payment is PROCESSING or UNKNOWN; reconcile with the same key.' })
  @ApiBadRequestResponse({ description: 'IDEMPOTENCY_KEY_REQUIRED, INVALID_PAYMENT_METHOD, VALIDATION_ERROR.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiNotFoundResponse({ description: 'ORDER_NOT_FOUND, RESERVATION_NOT_FOUND.' })
  @ApiConflictResponse({ description: 'IDEMPOTENCY_KEY_REUSED, ORDER_NOT_PAYABLE, ORDER_NOT_RETRYABLE, PAYMENT_IN_PROGRESS, RESERVATION_EXPIRED, INVALID_RESERVATION_STATE, OUT_OF_STOCK.' })
  async createOrReplay(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PaymentResponse> {
    const result = await this.paymentsService.createOrReplay(
      user.userId,
      idempotencyKey,
      input,
    );
    if (result.status === PaymentAttemptStatus.PROCESSING || result.status === PaymentAttemptStatus.UNKNOWN) {
      response.status(HttpStatus.ACCEPTED);
    }
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a PaymentAttempt owned by the authenticated user for polling' })
  @ApiOkResponse({ type: PaymentDetailResponseDto, description: 'Persisted attempt, Order, and reservation status; no gateway call is made.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  @ApiNotFoundResponse({ description: 'PAYMENT_ATTEMPT_NOT_FOUND (missing or not owned by the user).' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentDetailResponse> {
    return this.paymentsService.findOwned(user.userId, id);
  }
}
