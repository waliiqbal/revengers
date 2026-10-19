/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StoryService } from './story.service';
import { CompleteStageDto, StartStageDto } from './dto/story.dto';

// 📖 Story mode — stages order me khulte hain, pehli baar clear karne pe rewards
@ApiTags('Story')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@UseGuards(AuthGuard('jwt'))
@Controller('story')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Get('progress')
  @ApiOperation({ summary: 'Stages with locked / unlocked / cleared state, next stage, skill points, completed chapters' })
  async progress(@Req() req) {
    return this.storyService.getProgress(req.user.userId);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start a stage (must be unlocked). Returns a runId for /story/complete.' })
  @ApiBody({ type: StartStageDto })
  async start(@Req() req, @Body() body: StartStageDto) {
    return this.storyService.startStage(req.user.userId, body.stage);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Finish a stage. First clear gives coins + skill points; the last stage of a chapter records the chapter as completed.' })
  @ApiBody({ type: CompleteStageDto })
  async complete(@Req() req, @Body() body: CompleteStageDto) {
    return this.storyService.completeStage(req.user.userId, body);
  }
}
