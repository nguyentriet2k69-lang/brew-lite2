import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'mvpPasswordPolicy', async: false })
class MvpPasswordPolicyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    return Array.from(value).length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be at least 8 characters and at most 72 UTF-8 bytes.`;
  }
}

export class RegisterDto {
  @ApiProperty({ example: 'Nguyen Van A', maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ example: 'user@example.com', maxLength: 254 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    minLength: 8,
    description: 'At least 8 characters and no more than 72 UTF-8 bytes.',
    writeOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  @Validate(MvpPasswordPolicyConstraint)
  password: string;
}
