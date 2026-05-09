import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TimelineService } from './timeline.service';
import {
  CreateTrackDto, UpdateTrackDto,
  CreateClipDto, UpdateClipDto, SplitClipDto, BatchClipOperationDto,
  CreateEffectDto, UpdateEffectDto, ReorderEffectsDto,
  CreateTransitionDto, UpdateTransitionDto,
  CreateTextOverlayDto, UpdateTextOverlayDto,
} from './dto/timeline.dto';

@ApiTags('Timeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  // === Tracks ===
  @Post('tracks')
  @ApiOperation({ summary: 'Add track' })
  createTrack(@Param('projectId') projectId: string, @Body() dto: CreateTrackDto, @Request() req: any) {
    return this.timelineService.createTrack(projectId, dto, req.user.id);
  }

  @Patch('tracks/:trackId')
  @ApiOperation({ summary: 'Update track' })
  updateTrack(@Param('projectId') projectId: string, @Param('trackId') trackId: string, @Body() dto: UpdateTrackDto, @Request() req: any) {
    return this.timelineService.updateTrack(projectId, trackId, dto, req.user.id);
  }

  @Delete('tracks/:trackId')
  @ApiOperation({ summary: 'Delete track' })
  deleteTrack(@Param('projectId') projectId: string, @Param('trackId') trackId: string, @Request() req: any) {
    return this.timelineService.deleteTrack(projectId, trackId, req.user.id);
  }

  // === Clips ===
  @Post('clips')
  @ApiOperation({ summary: 'Add clip' })
  createClip(@Param('projectId') projectId: string, @Body() dto: CreateClipDto, @Request() req: any) {
    return this.timelineService.createClip(projectId, dto, req.user.id);
  }

  @Patch('clips/:clipId')
  @ApiOperation({ summary: 'Update clip (move, trim, transform)' })
  updateClip(@Param('projectId') projectId: string, @Param('clipId') clipId: string, @Body() dto: UpdateClipDto, @Request() req: any) {
    return this.timelineService.updateClip(projectId, clipId, dto, req.user.id);
  }

  @Delete('clips/:clipId')
  @ApiOperation({ summary: 'Soft delete clip' })
  deleteClip(@Param('projectId') projectId: string, @Param('clipId') clipId: string, @Request() req: any) {
    return this.timelineService.deleteClip(projectId, clipId, req.user.id);
  }

  @Post('clips/:clipId/split')
  @ApiOperation({ summary: 'Split clip at timecode' })
  splitClip(@Param('projectId') projectId: string, @Param('clipId') clipId: string, @Body() dto: SplitClipDto, @Request() req: any) {
    return this.timelineService.splitClip(projectId, clipId, dto, req.user.id);
  }

  @Post('clips/batch')
  @ApiOperation({ summary: 'Batch clip operations (atomic transaction)' })
  batchClips(@Param('projectId') projectId: string, @Body() dto: BatchClipOperationDto, @Request() req: any) {
    return this.timelineService.batchClipOperations(projectId, dto, req.user.id);
  }

  // === Effects ===
  @Post('clips/:clipId/effects')
  @ApiOperation({ summary: 'Add effect to clip' })
  addEffect(@Param('projectId') projectId: string, @Param('clipId') clipId: string, @Body() dto: CreateEffectDto, @Request() req: any) {
    return this.timelineService.addEffect(projectId, clipId, dto, req.user.id);
  }

  @Patch('clips/:clipId/effects/:effectId')
  @ApiOperation({ summary: 'Update effect params' })
  updateEffect(@Param('projectId') projectId: string, @Param('clipId') clipId: string, @Param('effectId') effectId: string, @Body() dto: UpdateEffectDto, @Request() req: any) {
    return this.timelineService.updateEffect(projectId, clipId, effectId, dto, req.user.id);
  }

  @Delete('clips/:clipId/effects/:effectId')
  @ApiOperation({ summary: 'Delete effect' })
  deleteEffect(@Param('projectId') projectId: string, @Param('clipId') clipId: string, @Param('effectId') effectId: string, @Request() req: any) {
    return this.timelineService.deleteEffect(projectId, clipId, effectId, req.user.id);
  }

  @Patch('clips/:clipId/effects/reorder')
  @ApiOperation({ summary: 'Reorder effects' })
  reorderEffects(@Param('projectId') projectId: string, @Param('clipId') clipId: string, @Body() dto: ReorderEffectsDto, @Request() req: any) {
    return this.timelineService.reorderEffects(projectId, clipId, dto, req.user.id);
  }

  // === Transitions ===
  @Post('transitions')
  @ApiOperation({ summary: 'Add transition' })
  createTransition(@Param('projectId') projectId: string, @Body() dto: CreateTransitionDto, @Request() req: any) {
    return this.timelineService.createTransition(projectId, dto, req.user.id);
  }

  @Patch('transitions/:transitionId')
  @ApiOperation({ summary: 'Update transition' })
  updateTransition(@Param('projectId') projectId: string, @Param('transitionId') transitionId: string, @Body() dto: UpdateTransitionDto, @Request() req: any) {
    return this.timelineService.updateTransition(projectId, transitionId, dto, req.user.id);
  }

  @Delete('transitions/:transitionId')
  @ApiOperation({ summary: 'Delete transition' })
  deleteTransition(@Param('projectId') projectId: string, @Param('transitionId') transitionId: string, @Request() req: any) {
    return this.timelineService.deleteTransition(projectId, transitionId, req.user.id);
  }

  // === Text Overlays ===
  @Post('text-overlays')
  @ApiOperation({ summary: 'Add text overlay' })
  createTextOverlay(@Param('projectId') projectId: string, @Body() dto: CreateTextOverlayDto, @Request() req: any) {
    return this.timelineService.createTextOverlay(projectId, dto, req.user.id);
  }

  @Patch('text-overlays/:overlayId')
  @ApiOperation({ summary: 'Update text overlay' })
  updateTextOverlay(@Param('projectId') projectId: string, @Param('overlayId') overlayId: string, @Body() dto: UpdateTextOverlayDto, @Request() req: any) {
    return this.timelineService.updateTextOverlay(projectId, overlayId, dto, req.user.id);
  }

  @Delete('text-overlays/:overlayId')
  @ApiOperation({ summary: 'Delete text overlay' })
  deleteTextOverlay(@Param('projectId') projectId: string, @Param('overlayId') overlayId: string, @Request() req: any) {
    return this.timelineService.deleteTextOverlay(projectId, overlayId, req.user.id);
  }
}
