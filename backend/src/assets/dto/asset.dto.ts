import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty({ enum: ['video', 'audio', 'image'] })
  @IsIn(['video', 'audio', 'image'])
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class ConfirmUploadDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty()
  @IsString()
  assetId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
