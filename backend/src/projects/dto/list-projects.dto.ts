import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginationDto } from '../../common/dto/pagination.dto';

export class ListProjectsDto extends CursorPaginationDto {
  @ApiProperty()
  @IsString()
  workspaceId!: string;
}
