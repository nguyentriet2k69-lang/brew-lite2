import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const product = {
  id: 'product-1',
  name: 'Latte BrewLite',
  basePrice: 45_000,
  stock: 12,
  imageUrl: null,
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

async function pauseForDemo(page: Page) {
  if (process.env.BREWLITE_RECORD_VIDEO === '1') {
    await page.waitForTimeout(700);
  }
}

test('customer can browse, register, pay, and view order history', async ({ page }) => {
  await page.goto('/');
  await pauseForDemo(page);

  await expect(
    page.getByRole('heading', { name: 'Một ly ngon, theo cách của bạn.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tùy chỉnh món' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('radio', { name: /Lớn/ }).check();
  await page.getByRole('checkbox', { name: /Trân châu/ }).check();
  await page.getByRole('button', { name: 'Thêm vào giỏ' }).click();
  await pauseForDemo(page);

  await page.getByRole('button', { name: 'Giỏ hàng (1)' }).click();
  await page.getByRole('button', { name: 'Đăng nhập để thanh toán' }).click();
  await page.getByRole('button', { name: /Chưa có tài khoản\? Đăng ký/ }).click();
  await page.getByLabel('Họ tên').fill('BrewLite Test');
  await page.getByLabel('Email').fill('brewlite@example.test');
  await page.getByLabel('Mật khẩu').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await pauseForDemo(page);

  await page.getByRole('button', { name: 'Tạo đơn & thanh toán' }).click();
  await expect(
    page.getByRole('heading', { name: 'Đặt hàng thành công' }),
  ).toBeVisible();
  await expect(page.getByText(order.id)).toBeVisible();
  await pauseForDemo(page);

  await page.getByRole('button', { name: 'Xem đơn hàng' }).click();
  await expect(
    page.getByRole('heading', { name: 'Lịch sử đơn hàng' }),
  ).toBeVisible();
  await expect(page.getByText('Đã thanh toán')).toBeVisible();
  await pauseForDemo(page);
});

test.describe('offline app shell', () => {
  test.use({ serviceWorkers: 'allow' });

  test('serves the cached app shell and manifest without a network', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Một ly ngon, theo cách của bạn.' }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    const manifest = await page.evaluate(async () => {
      const response = await fetch('/manifest.webmanifest');
      return { ok: response.ok, body: await response.json() };
    });
    expect(manifest.ok).toBeTruthy();
    expect(manifest.body.name).toContain('BrewLite');

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Một ly ngon, theo cách của bạn.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: product.name }),
    ).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Một ly ngon, theo cách của bạn.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: product.name }),
    ).toBeVisible();
  });
});
