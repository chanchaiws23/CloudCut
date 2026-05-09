import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExportDto {
  @ApiProperty({ enum: ['mp4', 'webm'], default: 'mp4' })
  @IsOptional()
  @IsIn(['mp4', 'webm'])
  format?: string;

  @ApiProperty({ enum: ['720p', '1080p', '4k'], default: '1080p' })
  @IsOptional()
  @IsIn(['720p', '1080p', '4k'])
  resolution?: string;

  @ApiProperty({ enum: ['draft', 'standard', 'high'], default: 'standard' })
  @IsOptional()
  @IsIn(['draft', 'standard', 'high'])
  quality?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
