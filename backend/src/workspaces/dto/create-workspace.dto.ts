import { IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'My Studio' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'my-studio' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug!: string;

  @ApiProperty({ required: false, enum: ['free', 'pro', 'team'] })
  @IsOptional()
  @IsIn(['free', 'pro', 'team'])
  plan?: string;
}

export class InviteMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  email!: string;

  @ApiProperty({ enum: ['admin', 'editor', 'viewer'], default: 'editor' })
  @IsOptional()
  @IsIn(['admin', 'editor', 'viewer'])
  role?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['admin', 'editor', 'viewer'] })
  @IsIn(['admin', 'editor', 'viewer'])
  role!: string;
}
