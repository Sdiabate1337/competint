import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import type { StartDiscoveryDto } from './discovery.service';

@Controller('discovery')
export class DiscoveryController {
    constructor(private readonly discoveryService: DiscoveryService) { }

    @Post('start')
    async startDiscovery(@Body() dto: StartDiscoveryDto) {
        // TODO: Extract organization ID from authenticated user
        const organizationId = 'demo-org-id';
        return this.discoveryService.startDiscovery(dto, organizationId);
    }

    @Get('runs/:id')
    async getRunStatus(@Param('id') id: string) {
        return this.discoveryService.getRunStatus(id);
    }

    @Get('projects/:projectId/runs')
    async listRuns(@Param('projectId') projectId: string) {
        return this.discoveryService.listRuns(projectId);
    }
}
