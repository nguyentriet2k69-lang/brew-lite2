'use client';

import Image from 'next/image';
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

interface Product {
  id: string;
  name: string;
  basePrice: number;
  stock: number;
  imageUrl: string | null;
}

interface SizeOption {
  code: string;
  name: string;
  priceAdjustment: number;
}

interface ToppingOption {
  id: string;
  name: string;
  priceAdjustment: number;
}

interface PricingOptions {
  currency: 'VND';
  sizes: SizeOption[];
  toppings: ToppingOption[];
}

interface CartLine {
  productId: string;
  productName: string;
  basePrice: number;
  sizeCode: string;
  toppingIds: string[];
  quantity: number;
}

interface AuthResponse {
  accessToken: string;
  user: { id: string; fullName: string; email: string };
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sizeSnapshot: { name: string };
    toppingsSnapshot: Array<{ name: string }>;
  }>;
  createdAt: string;
}

interface OrderPage {
  items: Order[];
  page: number;
  pageSize: number;
  total: number;
}

interface PaymentResult {
  paymentAttemptId: string;
  orderId: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  amount: number;
  orderStatus: string;
}

type View = 'menu' | 'cart' | 'auth' | 'history' | 'confirmation';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const productionApiUrl = 'https://brew-lite2-backend.onrender.com';
const usesLocalProductionApi =
  process.env.NODE_ENV === 'production' &&
  /^https?:\/\/(localhost|127\.0\.0\.1):3001(?:\/|$)/i.test(
    configuredApiUrl ?? '',
  );
const API_URL =
  configuredApiUrl && !usesLocalProductionApi
    ? configuredApiUrl
    : process.env.NODE_ENV === 'production'
      ? productionApiUrl
      : 'http://localhost:3001';
const CART_STORAGE_KEY = 'brewlite-cart-v1';
const TOKEN_STORAGE_KEY = 'brewlite-access-token';
const cartListeners = new Set<() => void>();
const tokenListeners = new Set<() => void>();

function getCartSnapshot(): string {
  return typeof window === 'undefined'
    ? '[]'
    : (localStorage.getItem(CART_STORAGE_KEY) ?? '[]');
}

function getServerCartSnapshot(): string {
  return '[]';
}

function subscribeToCart(listener: () => void): () => void {
  cartListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    cartListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function saveCart(cart: CartLine[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  cartListeners.forEach((listener) => listener());
}

function getTokenSnapshot(): string | null {
  return typeof window === 'undefined'
    ? null
    : sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

function getServerTokenSnapshot(): null {
  return null;
}

function subscribeToToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    tokenListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function saveToken(token: string | null) {
  if (token) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  tokenListeners.forEach((listener) => listener());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.basePrice === 'number' &&
    typeof value.stock === 'number' &&
    (typeof value.imageUrl === 'string' || value.imageUrl === null)
  );
}

function isCartLine(value: unknown): value is CartLine {
  return (
    isRecord(value) &&
    typeof value.productId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.basePrice === 'number' &&
    typeof value.sizeCode === 'string' &&
    Array.isArray(value.toppingIds) &&
    value.toppingIds.every((id) => typeof id === 'string') &&
    typeof value.quantity === 'number' &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0
  );
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const message = isRecord(body) ? body.message : undefined;
    throw new Error(
      typeof message === 'string'
        ? message
        : Array.isArray(message)
          ? message.join(', ')
          : `Yêu cầu thất bại (HTTP ${response.status}).`,
    );
  }

  return body as T;
}

function formatPrice(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<PricingOptions | null>(null);
  const cartSnapshot = useSyncExternalStore(
    subscribeToCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );
  const token = useSyncExternalStore(
    subscribeToToken,
    getTokenSnapshot,
    getServerTokenSnapshot,
  );
  const cartState = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(cartSnapshot);
      if (!Array.isArray(parsed) || !parsed.every(isCartLine)) {
        return { items: [] as CartLine[], error: 'Dữ liệu giỏ hàng đã lưu không hợp lệ.' };
      }
      return { items: parsed, error: null };
    } catch {
      return { items: [] as CartLine[], error: 'Không thể đọc dữ liệu giỏ hàng đã lưu.' };
    }
  }, [cartSnapshot]);
  const cart = cartState.items;
  const [view, setView] = useState<View>('menu');
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [history, setHistory] = useState<OrderPage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'WALLET'>(
    'WALLET',
  );
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderKey, setOrderKey] = useState<string | null>(null);
  const [paymentKey, setPaymentKey] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null,
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<unknown>('/products'),
      apiRequest<PricingOptions>('/pricing/options'),
    ])
      .then(([productResponse, pricingResponse]) => {
        if (!Array.isArray(productResponse) || !productResponse.every(isProduct)) {
          throw new Error('API trả về danh sách sản phẩm không hợp lệ.');
        }
        if (
          !Array.isArray(pricingResponse.sizes) ||
          !Array.isArray(pricingResponse.toppings)
        ) {
          throw new Error('API trả về cấu hình giá không hợp lệ.');
        }
        if (active) {
          setProducts(productResponse);
          setPricing(pricingResponse);
        }
      })
      .catch((error: unknown) => {
        if (active) setMenuError(errorMessage(error));
      })
      .finally(() => {
        if (active) setMenuLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);

  const cartTotal = useMemo(() => {
    if (!pricing) return 0;
    return cart.reduce((total, line) => {
      const sizeAdjustment =
        pricing.sizes.find((size) => size.code === line.sizeCode)
          ?.priceAdjustment ?? 0;
      const toppingAdjustment = line.toppingIds.reduce(
        (sum, id) =>
          sum +
          (pricing.toppings.find((topping) => topping.id === id)
            ?.priceAdjustment ?? 0),
        0,
      );
      return (
        total +
        (line.basePrice + sizeAdjustment + toppingAdjustment) * line.quantity
      );
    }, 0);
  }, [cart, pricing]);

  function updateCart(nextCart: CartLine[]) {
    saveCart(nextCart);
    setOrderKey(null);
  }

  async function openProduct(product: Product) {
    if (orderId) {
      setActionError('Hoàn tất hoặc bắt đầu lại đơn hiện tại trước khi sửa giỏ.');
      return;
    }
    setActionError(null);
    setDetailLoading(true);
    setSelectedSize(pricing?.sizes[0]?.code ?? 'M');
    setSelectedToppings([]);
    try {
      const detail = await apiRequest<unknown>(
        `/products/${encodeURIComponent(product.id)}`,
      );
      if (!isProduct(detail)) {
        throw new Error('API trả về chi tiết sản phẩm không hợp lệ.');
      }
      setSelectedProduct(detail);
    } catch (error) {
      setActionError(`Không thể tải chi tiết sản phẩm: ${errorMessage(error)}`);
    } finally {
      setDetailLoading(false);
    }
  }

  function addToCart() {
    if (!selectedProduct) return;
    const toppingIds = [...selectedToppings].sort();
    const existing = cart.find(
      (line) =>
        line.productId === selectedProduct.id &&
        line.sizeCode === selectedSize &&
        line.toppingIds.join(',') === toppingIds.join(','),
    );
    updateCart(
      existing
        ? cart.map((line) =>
            line === existing
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [
            ...cart,
            {
              productId: selectedProduct.id,
              productName: selectedProduct.name,
              basePrice: selectedProduct.basePrice,
              sizeCode: selectedSize,
              toppingIds,
              quantity: 1,
            },
          ],
    );
    setSelectedProduct(null);
    setNotice(`${selectedProduct.name} đã được thêm vào giỏ.`);
    setView('menu');
  }

  function changeQuantity(index: number, amount: number) {
    const nextCart = cart
      .map((line, lineIndex) =>
        lineIndex === index
          ? { ...line, quantity: line.quantity + amount }
          : line,
      )
      .filter((line) => line.quantity > 0);
    updateCart(nextCart);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setActionError(null);
    try {
      const endpoint =
        authMode === 'register' ? '/auth/register' : '/auth/login';
      const body =
        authMode === 'register'
          ? { fullName, email, password }
          : { email, password };
      const response = await apiRequest<AuthResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!response.accessToken || !response.user?.email) {
        throw new Error('API không trả về thông tin đăng nhập hợp lệ.');
      }
      saveToken(response.accessToken);
      setPassword('');
      setNotice(`Xin chào ${response.user.fullName}.`);
      setView('cart');
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }

  function signOut() {
    saveToken(null);
    setHistory(null);
    setOrderId(null);
    setOrderKey(null);
    setPaymentKey(null);
    setPaymentResult(null);
    setNotice('Bạn đã đăng xuất.');
    setView('menu');
  }

  async function showHistory() {
    if (!token) {
      setNotice('Đăng nhập để xem lịch sử đơn hàng.');
      setView('auth');
      return;
    }
    setHistoryLoading(true);
    setActionError(null);
    setView('history');
    try {
      setHistory(
        await apiRequest<OrderPage>('/orders/me?page=1&pageSize=20', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
    } catch (error) {
      setActionError(`Không thể tải lịch sử đơn: ${errorMessage(error)}`);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function checkout() {
    if (!token) {
      setNotice('Đăng nhập để tiếp tục đặt hàng.');
      setView('auth');
      return;
    }
    if (!cart.length) {
      setActionError('Giỏ hàng đang trống.');
      return;
    }

    setCheckoutLoading(true);
    setActionError(null);
    try {
      let activeOrderId = orderId;
      if (!activeOrderId) {
        const activeOrderKey = orderKey ?? crypto.randomUUID();
        setOrderKey(activeOrderKey);
        const order = await apiRequest<Order>('/orders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': activeOrderKey,
          },
          body: JSON.stringify({
            items: cart.map(({ productId, quantity, sizeCode, toppingIds }) => ({
              productId,
              quantity,
              sizeCode,
              toppingIds,
            })),
          }),
        });
        activeOrderId = order.id;
        setOrderId(order.id);
      }

      const activePaymentKey = paymentKey ?? crypto.randomUUID();
      setPaymentKey(activePaymentKey);
      const payment = await apiRequest<PaymentResult>('/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': activePaymentKey,
        },
        body: JSON.stringify({ orderId: activeOrderId, method: paymentMethod }),
      });
      setPaymentResult(payment);

      if (payment.status === 'SUCCESS') {
        updateCart([]);
        setOrderId(null);
        setOrderKey(null);
        setPaymentKey(null);
        setView('confirmation');
        setNotice('Thanh toán thành công.');
      } else if (payment.status === 'FAILED') {
        setPaymentKey(null);
        setActionError(
          'Thanh toán bị từ chối. Giỏ hàng được giữ lại; bạn có thể thử lại bằng một lần thanh toán mới.',
        );
      } else {
        setActionError(
          'Chưa xác định được kết quả thanh toán. Giữ nguyên mã yêu cầu và kiểm tra lại để tránh tạo giao dịch trùng.',
        );
      }
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setCheckoutLoading(false);
    }
  }

  const statusLabel: Record<string, string> = {
    PENDING: 'Chờ thanh toán',
    PAID: 'Đã thanh toán',
    PAYMENT_FAILED: 'Thanh toán thất bại',
    CANCELLED: 'Đã hủy',
  };

  return (
    <main className="min-h-screen bg-[#f8f5f2] px-4 pb-12 text-stone-800">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 py-7 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => setView('menu')}
            aria-label="Về menu BrewLite"
          >
            <span className="rounded-full bg-amber-100 p-3 text-2xl">☕</span>
            <span>
              <span className="block text-2xl font-extrabold tracking-tight">
                BrewLite
              </span>
              <span className="block text-sm text-stone-500">
                Cà phê yêu thích, đặt trước vài chạm
              </span>
            </span>
          </button>
          <nav className="flex flex-wrap gap-2" aria-label="Điều hướng chính">
            <button
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold"
              onClick={() => setView('menu')}
            >
              Menu
            </button>
            <button
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold"
              onClick={() => setView('cart')}
            >
              Giỏ hàng ({cartCount})
            </button>
            <button
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold"
              onClick={showHistory}
            >
              Đơn hàng
            </button>
            {token ? (
                <button
                  className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold"
                  onClick={signOut}
                >
                  Đăng xuất
                </button>
              ) : (
                <button
                  className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => setView('auth')}
                >
                  Đăng nhập
                </button>
              )}
          </nav>
        </header>

        {notice && (
          <p
            className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800"
            role="status"
          >
            {notice}
            <button
              className="ml-3 font-bold underline"
              onClick={() => setNotice(null)}
            >
              Đóng
            </button>
          </p>
        )}
        {actionError && (
          <p
            className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {actionError}
          </p>
        )}

        {view === 'menu' && (
          <section aria-labelledby="menu-heading">
            <div className="mb-6 rounded-3xl bg-amber-900 px-6 py-8 text-white sm:px-10">
              <p className="mb-2 text-sm font-bold uppercase tracking-widest text-amber-200">
                Pha mới mỗi ngày
              </p>
              <h1 id="menu-heading" className="text-3xl font-extrabold sm:text-4xl">
                Một ly ngon, theo cách của bạn.
              </h1>
              <p className="mt-3 max-w-xl text-sm text-amber-100">
                Chọn size, thêm topping và thanh toán mô phỏng an toàn ngay trên
                điện thoại.
              </p>
            </div>
            {menuLoading ? (
              <p className="py-16 text-center" role="status">
                Đang tải menu…
              </p>
            ) : menuError ? (
              <div className="rounded-2xl bg-red-50 p-6 text-center text-red-800">
                <p>{menuError}</p>
                <button
                  className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-white"
                  onClick={() => window.location.reload()}
                >
                  Thử tải lại
                </button>
              </div>
            ) : products.length === 0 ? (
              <p className="rounded-2xl bg-white p-8 text-center text-stone-500">
                Menu hiện đang trống.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm"
                  >
                    <div className="relative h-44 bg-amber-50">
                      {product.imageUrl && (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-bold">{product.name}</h2>
                          <p className="mt-1 font-extrabold text-amber-700">
                            {formatPrice(product.basePrice)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            product.stock > 0
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {product.stock > 0 ? `Còn ${product.stock}` : 'Hết hàng'}
                        </span>
                      </div>
                      <button
                        className="mt-4 w-full rounded-xl bg-amber-700 px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                        disabled={product.stock <= 0 || !pricing}
                        onClick={() => void openProduct(product)}
                      >
                        Tùy chỉnh món
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'cart' && (
          <section className="mx-auto max-w-3xl" aria-labelledby="cart-heading">
            <h1 id="cart-heading" className="mb-5 text-2xl font-extrabold">
              Giỏ hàng
            </h1>
            {cartState.error ? (
              <div className="rounded-2xl bg-red-50 p-6 text-red-800" role="alert">
                <p>{cartState.error}</p>
                <button
                  className="mt-3 font-bold underline"
                  onClick={() => updateCart([])}
                >
                  Xóa dữ liệu giỏ hàng lỗi
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center">
                <p className="text-stone-600">Giỏ hàng của bạn đang trống.</p>
                <button
                  className="mt-4 rounded-xl bg-amber-700 px-5 py-3 font-bold text-white"
                  onClick={() => setView('menu')}
                >
                  Chọn món
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((line, index) => {
                  const sizeName =
                    pricing?.sizes.find((size) => size.code === line.sizeCode)
                      ?.name ?? line.sizeCode;
                  const toppings = line.toppingIds
                    .map(
                      (id) =>
                        pricing?.toppings.find((topping) => topping.id === id)
                          ?.name,
                    )
                    .filter((name): name is string => Boolean(name));
                  return (
                    <article
                      key={`${line.productId}-${line.sizeCode}-${line.toppingIds.join('-')}`}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4"
                    >
                      <div>
                        <h2 className="font-bold">{line.productName}</h2>
                        <p className="text-sm text-stone-500">
                          Size {sizeName}
                          {toppings.length ? ` · ${toppings.join(', ')}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          aria-label={`Giảm số lượng ${line.productName}`}
                          className="h-9 w-9 rounded-full border border-stone-300"
                          onClick={() => changeQuantity(index, -1)}
                          disabled={Boolean(orderId)}
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center">{line.quantity}</span>
                        <button
                          aria-label={`Tăng số lượng ${line.productName}`}
                          className="h-9 w-9 rounded-full border border-stone-300"
                          onClick={() => changeQuantity(index, 1)}
                          disabled={Boolean(orderId)}
                        >
                          +
                        </button>
                        <button
                          className="ml-2 text-sm font-semibold text-red-700 underline"
                          onClick={() => changeQuantity(index, -line.quantity)}
                          disabled={Boolean(orderId)}
                        >
                          Xóa
                        </button>
                      </div>
                    </article>
                  );
                })}
                <div className="rounded-2xl bg-white p-5">
                  <div className="flex justify-between text-lg font-extrabold">
                    <span>Tạm tính</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                  {orderId ? (
                    <div className="mt-5">
                      <p className="mb-3 text-sm text-stone-600">
                        Đơn {orderId.slice(0, 8)} · chọn phương thức thanh toán
                      </p>
                      <div className="mb-4 flex gap-3">
                        {(['WALLET', 'CARD'] as const).map((method) => (
                          <label
                            key={method}
                            className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2"
                          >
                            <input
                              type="radio"
                              name="payment-method"
                              value={method}
                              checked={paymentMethod === method}
                              onChange={() => setPaymentMethod(method)}
                              disabled={Boolean(paymentKey)}
                            />
                            {method === 'WALLET' ? 'Ví điện tử' : 'Thẻ'}
                          </label>
                        ))}
                      </div>
                      {paymentResult && paymentResult.status !== 'SUCCESS' && (
                        <p className="mb-3 text-sm text-amber-800" role="status">
                          Trạng thái lần thanh toán: {paymentResult.status}
                          {paymentResult.paymentAttemptId
                            ? ` · ${paymentResult.paymentAttemptId.slice(0, 8)}`
                            : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-stone-500">
                      Giá cuối cùng được API xác nhận khi tạo đơn.
                    </p>
                  )}
                  <button
                    className="mt-5 w-full rounded-xl bg-amber-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                    disabled={checkoutLoading || !pricing}
                    onClick={() => void checkout()}
                  >
                    {checkoutLoading
                      ? 'Đang xử lý…'
                      : orderId
                        ? paymentResult?.status === 'UNKNOWN' ||
                          paymentResult?.status === 'PROCESSING'
                          ? 'Kiểm tra lại thanh toán'
                          : 'Thanh toán mock'
                        : token
                          ? 'Tạo đơn & thanh toán'
                          : 'Đăng nhập để thanh toán'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {view === 'auth' && (
          <section
            className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm"
            aria-labelledby="auth-heading"
          >
            <h1 id="auth-heading" className="mb-5 text-2xl font-extrabold">
              {authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </h1>
            <form className="space-y-4" onSubmit={(event) => void submitAuth(event)}>
              {authMode === 'register' && (
                <label className="block text-sm font-semibold">
                  Họ tên
                  <input
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="block text-sm font-semibold">
                Email
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm font-semibold">
                Mật khẩu
                <input
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={authMode === 'register' ? 8 : undefined}
                  maxLength={72}
                  autoComplete={
                    authMode === 'register' ? 'new-password' : 'current-password'
                  }
                />
              </label>
              <button
                className="w-full rounded-xl bg-amber-700 px-4 py-3 font-bold text-white disabled:bg-stone-300"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Đang xử lý…'
                  : authMode === 'login'
                    ? 'Đăng nhập'
                    : 'Đăng ký'}
              </button>
            </form>
            <button
              className="mt-4 text-sm font-semibold text-amber-800 underline"
              onClick={() =>
                setAuthMode(authMode === 'login' ? 'register' : 'login')
              }
            >
              {authMode === 'login'
                ? 'Chưa có tài khoản? Đăng ký'
                : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </section>
        )}

        {view === 'history' && (
          <section aria-labelledby="history-heading">
            <h1 id="history-heading" className="mb-5 text-2xl font-extrabold">
              Lịch sử đơn hàng
            </h1>
            {historyLoading ? (
              <p role="status">Đang tải đơn hàng…</p>
            ) : history?.items.length ? (
              <div className="space-y-3">
                {history.items.map((order) => (
                  <article key={order.id} className="rounded-2xl bg-white p-5">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-bold">Đơn {order.id.slice(0, 8)}</p>
                      <span className="text-sm font-semibold text-amber-800">
                        {statusLabel[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {new Date(order.createdAt).toLocaleString('vi-VN')}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between gap-3">
                          <span>
                            {item.quantity} × {item.productName} ({item.sizeSnapshot.name})
                          </span>
                          <span>{formatPrice(item.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-right font-extrabold">
                      Tổng: {formatPrice(order.totalAmount)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-white p-8 text-center text-stone-500">
                Chưa có đơn hàng nào.
              </p>
            )}
          </section>
        )}

        {view === 'confirmation' && paymentResult && (
          <section
            className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm"
            aria-labelledby="confirmation-heading"
          >
            <span className="text-5xl" aria-hidden="true">
              ✓
            </span>
            <h1 id="confirmation-heading" className="mt-3 text-2xl font-extrabold">
              Đặt hàng thành công
            </h1>
            <p className="mt-2 text-stone-600">
              Mã đơn: <strong>{paymentResult.orderId}</strong>
            </p>
            <p className="mt-1 text-stone-600">
              Trạng thái: {statusLabel[paymentResult.orderStatus] ?? paymentResult.orderStatus}
            </p>
            <p className="mt-1 font-bold">
              Tổng tiền: {formatPrice(paymentResult.amount)}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                className="rounded-xl bg-amber-700 px-4 py-2.5 font-bold text-white"
                onClick={showHistory}
              >
                Xem đơn hàng
              </button>
              <button
                className="rounded-xl border border-stone-300 px-4 py-2.5 font-bold"
                onClick={() => setView('menu')}
              >
                Về menu
              </button>
            </div>
          </section>
        )}
      </div>

      {detailLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <p className="rounded-xl bg-white px-5 py-3" role="status">
            Đang tải chi tiết món…
          </p>
        </div>
      )}
      {selectedProduct && pricing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <section
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-heading"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="product-dialog-heading"
                  className="text-xl font-extrabold"
                >
                  {selectedProduct.name}
                </h2>
                <p className="mt-1 text-amber-800">
                  Giá gốc {formatPrice(selectedProduct.basePrice)}
                </p>
              </div>
              <button
                className="rounded-full border border-stone-300 px-3 py-1"
                onClick={() => setSelectedProduct(null)}
                aria-label="Đóng chi tiết món"
              >
                Đóng
              </button>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 font-bold">Chọn size</legend>
              <div className="flex flex-wrap gap-2">
                {pricing.sizes.map((size) => (
                  <label
                    key={size.code}
                    className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2"
                  >
                    <input
                      type="radio"
                      name="size"
                      value={size.code}
                      checked={selectedSize === size.code}
                      onChange={() => setSelectedSize(size.code)}
                    />
                    {size.name} (+{formatPrice(size.priceAdjustment)})
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="mb-2 font-bold">Topping (không bắt buộc)</legend>
              <div className="space-y-2">
                {pricing.toppings.map((topping) => (
                  <label
                    key={topping.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedToppings.includes(topping.id)}
                        onChange={(event) =>
                          setSelectedToppings((current) =>
                            event.target.checked
                              ? [...current, topping.id]
                              : current.filter((id) => id !== topping.id),
                          )
                        }
                      />
                      {topping.name}
                    </span>
                    <span>+{formatPrice(topping.priceAdjustment)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="mt-6 w-full rounded-xl bg-amber-700 px-4 py-3 font-bold text-white"
              onClick={addToCart}
            >
              Thêm vào giỏ
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
