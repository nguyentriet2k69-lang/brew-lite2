import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateOrderDto, OrderListQueryDto } from './dto/create-order.dto';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

class OrderItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) productId: string;
  @ApiProperty() productName: string;
  @ApiProperty({ type: Number, example: 35000 }) basePrice: number;
  @ApiProperty({ type: Object, example: { code: 'M', name: 'Vừa', priceAdjustment: 5000 } }) sizeSnapshot: object;
  @ApiProperty({ type: [Object], example: [{ id: 'pearls', name: 'Trân châu', priceAdjustment: 6000 }] }) toppingsSnapshot: object[];
  @ApiProperty({ type: Number, example: 2 }) quantity: number;
  @ApiProperty({ type: Number, example: 46000 }) unitPrice: number;
  @ApiProperty({ type: Number, example: 92000 }) lineTotal: number;
}

class ReservationResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['HELD', 'PAYMENT_PENDING', 'CONSUMED', 'RELEASED', 'EXPIRED'] }) status: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: Date;
}

class OrderResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty({ enum: ['PENDING', 'PAID', 'PAYMENT_FAILED', 'CANCELLED'] }) status: string;
  @ApiProperty({ type: Number, example: 92000 }) totalAmount: number;
  @ApiProperty({ type: [OrderItemResponseDto] }) items: OrderItemResponseDto[];
  @ApiProperty({ type: [ReservationResponseDto] }) reservations: ReservationResponseDto[];
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}

class OrderPageResponseDto {
  @ApiProperty({ type: [OrderResponseDto] }) items: OrderResponseDto[];
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) pageSize: number;
  @ApiProperty({ example: 42 }) total: number;
}

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@ApiTags('Orders')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an Order and hold Product stock' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique key for this user and request, maximum 128 characters.' })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'INVALID_ORDER_ITEMS, IDEMPOTENCY_KEY_REQUIRED, VALIDATION_ERROR, INVALID_SIZE, INVALID_TOPPING, DUPLICATE_TOPPING.' })
  @ApiConflictResponse({ description: 'OUT_OF_STOCK, IDEMPOTENCY_KEY_REUSED, PRICE_OVERFLOW.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: CreateOrderDto,
  ): Promise<ReturnType<typeof toOrderResponse>> {
    return this.ordersService.create(request.user.userId, idempotencyKey, input)
      .then(toOrderResponse);
  }

  @Get('me')
  @ApiOperation({ summary: 'List the authenticated user’s Orders' })
  @ApiOkResponse({ type: OrderPageResponseDto, description: 'Paginated Order history.' })
  @ApiBadRequestResponse({ description: 'Pagination parameters failed validation.' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  findMine(@Req() request: AuthenticatedRequest, @Query() query: OrderListQueryDto) {
    return this.ordersService.findMine(request.user.userId, query).then((page) => ({
      ...page,
      items: page.items.map(toOrderResponse),
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one Order owned by the authenticated user' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'The Order id must be a UUID.' })
  @ApiNotFoundResponse({ description: 'ORDER_NOT_FOUND' })
  @ApiUnauthorizedResponse({ description: 'A valid bearer token is required.' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReturnType<typeof toOrderResponse>> {
    return this.ordersService.findOwned(request.user.userId, id).then(toOrderResponse);
  }
}

/** Serialize only fields in the public Order response contract. */
function toOrderResponse(order: Order) {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    totalAmount: order.totalAmount,
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      basePrice: item.basePrice,
      sizeSnapshot: item.sizeSnapshot,
      toppingsSnapshot: item.toppingsSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    reservations: (order.reservations ?? []).map((reservation) => ({
      id: reservation.id,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
