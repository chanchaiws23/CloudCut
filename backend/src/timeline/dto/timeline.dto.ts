import { Type } from 'class-transformer';
import { IsString, IsInt, IsOptional, IsBoolean, IsObject, IsIn, IsArray, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTrackDto {
  @ApiProperty({ enum: ['video', 'audio'] })
  @IsIn(['video', 'audio'])
  type!: string;

  @ApiProperty({ example: 'V1' })
  @IsString()
  label!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  orderIndex!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateTrackDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  orderIndex?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isMuted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateClipDto {
  @ApiProperty()
  @IsString()
  trackId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  trackPositionMs!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  inPointMs!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  outPointMs!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  transform?: Record<string, any>;
}

export class UpdateClipDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  trackId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  trackPositionMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  inPointMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  outPointMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  transform?: Record<string, any>;
}

export class SplitClipDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  atTimeMs!: number;
}

export class BatchClipOperationItemDto {
  @ApiProperty()
  @IsString()
  clipId!: string;

  @ApiProperty({ enum: ['move', 'delete', 'update'] })
  @IsIn(['move', 'delete', 'update'])
  action!: 'move' | 'delete' | 'update';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

export class BatchClipOperationDto {
  @ApiProperty({ type: [BatchClipOperationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchClipOperationItemDto)
  operations!: BatchClipOperationItemDto[];
}

export class CreateEffectDto {
  @ApiProperty({ enum: ['brightness', 'contrast', 'saturation', 'blur', 'grayscale', 'sepia'] })
  @IsIn(['brightness', 'contrast', 'saturation', 'blur', 'grayscale', 'sepia'])
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateEffectDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ReorderEffectsDto {
  @ApiProperty()
  @IsArray()
  effectIds!: string[];
}

export class CreateTransitionDto {
  @ApiProperty()
  @IsString()
  fromClipId!: string;

  @ApiProperty()
  @IsString()
  toClipId!: string;

  @ApiProperty({ enum: ['dissolve', 'wipe_left', 'wipe_right', 'fade'] })
  @IsIn(['dissolve', 'wipe_left', 'wipe_right', 'fade'])
  type!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  durationMs!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

export class UpdateTransitionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['dissolve', 'wipe_left', 'wipe_right', 'fade'])
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}

export class CreateTextOverlayDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  trackPositionMs!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  durationMs!: number;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  fontSize?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fontColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  @IsString()
  alignment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  animation?: string;
}

export class UpdateTextOverlayDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  trackPositionMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  fontSize?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fontColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  alignment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  animation?: string;
}
