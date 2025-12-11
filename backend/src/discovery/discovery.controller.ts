/**
 * Discovery Controller
 * 
 * API endpoints for competitor discovery:
 * - POST /discovery/runs - Start a new discovery
 * - GET /discovery/runs/:id - Get discovery run status
 * - GET /discovery/runs - List discovery runs for a project
 */

import { Controller, Post, Get, Param, Query, Body, UseGuards } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('discovery')
@UseGuards(AuthGuard)
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * Start a new discovery run
   */
  @Post('runs')
  async createRun(
    @Body() dto: CreateDiscoveryDto,
    @CurrentUser() user: any,
  ) {
    // Get organization from user's membership
    const organizationId = user.organization_id || user.organizationId;
    
    if (!organizationId) {
      throw new Error('User must belong to an organization');
    }

    return this.discoveryService.createRun(organizationId, user.id, dto);
  }

  /**
   * Get discovery run by ID
   */
  @Get('runs/:id')
  async getRun(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const organizationId = user.organization_id || user.organizationId;
    return this.discoveryService.getRun(id, organizationId);
  }

  /**
   * List discovery runs for a project
   */
  @Get('runs')
  async listRuns(
    @Query('projectId') projectId: string,
    @CurrentUser() user: any,
  ) {
    if (!projectId) {
      throw new Error('projectId query parameter is required');
    }

    const organizationId = user.organization_id || user.organizationId;
    return this.discoveryService.listRuns(projectId, organizationId);
  }
}
