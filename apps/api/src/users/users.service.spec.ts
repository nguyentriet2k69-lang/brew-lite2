import { UsersService } from './users.service';
import { User } from './user.entity';

describe('UsersService', () => {
  it('looks up email case-insensitively after normalization', async () => {
    const user = { id: 'user-id', email: 'user@example.com' } as User;
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn(),
      save: jest.fn(),
    };
    const service = new UsersService(repository as never);

    await expect(service.findByEmail(' User@Example.COM ')).resolves.toBe(user);
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'LOWER(user.email) = :email',
      { email: 'user@example.com' },
    );
    expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
  });

  it('stores only a normalized email and trimmed name in the user record', async () => {
    const record = {
      email: ' User@Example.COM ',
      passwordHash: '$2b$12$already-hashed-test-value',
      fullName: ' Nguyen Van A ',
    };
    const entity = { ...record, email: 'user@example.com', fullName: 'Nguyen Van A' };
    const repository = {
      create: jest.fn().mockReturnValue(entity),
      save: jest.fn().mockResolvedValue(entity),
    };
    const service = new UsersService(repository as never);

    await expect(service.create(record)).resolves.toBe(entity);
    expect(repository.create).toHaveBeenCalledWith({
      ...record,
      email: 'user@example.com',
      fullName: 'Nguyen Van A',
    });
  });
});
