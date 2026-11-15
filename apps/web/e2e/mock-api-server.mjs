import { createServer } from 'node:http';

const product = {
  id: 'product-1',
  name: 'Latte BrewLite',
  basePrice: 45_000,
  stock: 12,
  imageUrl: null,
};

const pricing = {
  currency: 'VND',
  sizes: [
    { code: 'M', name: 'Vừa', priceAdjustment: 0 },
    { code: 'L', name: 'Lớn', priceAdjustment: 10_000 },
  ],
  toppings: [{ id: 'topping-1', name: 'Trân châu', priceAdjustment: 5_000 }],
};

const order = {
  id: 'order-12345678',
  status: 'PENDING',
  totalAmount: 60_000,
  createdAt: '2026-11-15T00:00:00.000Z',
  items: [
    {
      id: 'item-1',
      productName: product.name,
      quantity: 1,
      unitPrice: 60_000,
      lineTotal: 60_000,
      sizeSnapshot: { name: 'Lớn' },
      toppingsSnapshot: [{ name: 'Trân châu' }],
    },
  ],
};

const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4173');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Authorization, Idempotency-Key',
  );
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url, 'http://127.0.0.1:4174');
  let body;

  if (request.method === 'GET' && url.pathname === '/products') {
    body = [product];
  } else if (
    request.method === 'GET' &&
    url.pathname === '/products/product-1'
  ) {
    body = product;
  } else if (request.method === 'GET' && url.pathname === '/pricing/options') {
    body = pricing;
  } else if (request.method === 'POST' && url.pathname === '/auth/register') {
    body = {
      accessToken: 'test-access-token',
      user: {
        id: 'user-1',
        fullName: 'BrewLite Test',
        email: 'brewlite@example.test',
      },
    };
  } else if (request.method === 'POST' && url.pathname === '/orders') {
    body = order;
  } else if (request.method === 'POST' && url.pathname === '/payments') {
    body = {
      paymentAttemptId: 'payment-1',
      orderId: order.id,
      status: 'SUCCESS',
      amount: order.totalAmount,
      orderStatus: 'PAID',
    };
  } else if (request.method === 'GET' && url.pathname === '/orders/me') {
    body = {
      items: [{ ...order, status: 'PAID' }],
      page: 1,
      pageSize: 20,
      total: 1,
    };
  } else {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
});

server.listen(4174, '127.0.0.1');
