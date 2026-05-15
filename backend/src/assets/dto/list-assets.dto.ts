import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPaginationDto } from '../../common/dto/pagination.dto';

export class ListAssetsDto extends CursorPaginationDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiPropertyOptional({ enum: ['video', 'audio', 'image'] })
  @IsOptional()
  @IsIn(['video', 'audio', 'image'])
  type?: string;

  @ApiPropertyOptional({ enum: ['uploading', 'processing', 'ready', 'failed'] })
  @IsOptional()
  @IsIn(['uploading', 'processing', 'ready', 'failed'])
  status?: string;
}
