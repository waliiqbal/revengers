/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { CharactersService } from './characters.service';
import { AscensionSettingsDto } from './dto/ascension.dto';

// 🎮 Game: character stars (ascension) — Select a Character screen + multiplayer host
@ApiTags('Characters')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@UseGuards(AuthGuard('jwt'))
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  @ApiOperation({ summary: 'My characters: stars, attack bonus and what the next star needs' })
  async all(@Req() req) {
    return this.charactersService.getAll(req.user.userId);
  }

  // /characters/bonus ko /:index se pehle rakhna zaroori hai
  @Get('bonus')
  @ApiOperation({ summary: "Another player's stars and attack bonus for a character (used by the multiplayer host)" })
  async bonus(@Query('userId') userId: string, @Query('character', ParseIntPipe) character: number) {
    return this.charactersService.bonusFor(userId, character);
  }

  @Get(':index')
  @ApiOperation({ summary: 'One of my characters: stars, attack bonus, next star requirements (and which are met)' })
  async one(@Req() req, @Param('index', ParseIntPipe) index: number) {
    return this.charactersService.getOne(req.user.userId, index);
  }

  @Post(':index/ascend')
  @ApiOperation({ summary: 'Buy the next star with diamonds. The server checks level, wins, story chapter and diamonds.' })
  @ApiResponse({ status: 400, description: 'A requirement is not met (the message says which)' })
  async ascend(@Req() req, @Param('index', ParseIntPipe) index: number) {
    return this.charactersService.ascend(req.user.userId, index);
  }
}

// 🔐 Admin: ascension rules (dashboard, Store page)
@ApiTags('Admin')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Admin role required' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin/settings/ascension')
export class AdminAscensionController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  @ApiOperation({ summary: 'Character ascension rules (diamonds, wins, level, chapter, attack per star)' })
  async get() {
    return { message: 'Ascension rules', data: await this.charactersService.getRulesWithMeta() };
  }

  @Put()
  @ApiOperation({ summary: 'Save ascension rules (stars already bought are kept)' })
  @ApiBody({ type: AscensionSettingsDto })
  async save(@Req() req, @Body() body: AscensionSettingsDto) {
    return { message: 'Ascension rules saved', data: await this.charactersService.saveRules(req.user.userId, body) };
  }

  @Post('reset')
  @ApiOperation({ summary: 'Put the ascension rules back to the document values' })
  async reset(@Req() req) {
    return { message: 'Ascension rules reset', data: await this.charactersService.resetRules(req.user.userId) };
  }
}
