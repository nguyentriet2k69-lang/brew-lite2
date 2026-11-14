import { PasswordHasherService, BCRYPT_SALT_ROUNDS } from './password-hasher.service';

describe('PasswordHasherService', () => {
  it('creates a bcrypt hash and verifies only the matching password', async () => {
    const hasher = new PasswordHasherService();
    const hash = await hasher.hash('test-only-password-not-a-user');

    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(BCRYPT_SALT_ROUNDS).toBe(12);
    await expect(
      hasher.compare('test-only-password-not-a-user', hash),
    ).resolves.toBe(true);
    await expect(hasher.compare('wrong-test-password', hash)).resolves.toBe(
      false,
    );
  });
});
