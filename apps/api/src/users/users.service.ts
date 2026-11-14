import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

export interface CreateUserRecord {
  email: string;
  passwordHash: string;
  fullName: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  create(record: CreateUserRecord): Promise<User> {
    const user = this.usersRepository.create({
      ...record,
      email: record.email.trim().toLowerCase(),
      fullName: record.fullName.trim(),
    });
    return this.usersRepository.save(user);
  }
}
