import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { CreateDiscoveryRunDto } from './dto/create-discovery-run.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('discovery')
@UseGuards(AuthGuard)
export class DiscoveryController {
    constructor(private readonly discoveryService: DiscoveryService) { }

    @Post('runs')
    createRun(
        @Body() createRunDto: CreateDiscoveryRunDto,
        @Query('organizationId', ParseUUIDPipe) organizationId: string,
        @CurrentUser() user: any,
    ) {
        return this.discoveryService.createRun(
            organizationId,
            user.id,
            createRunDto,
        );
    }

    @Get('runs/:id')
    getRun(@Param('id') id: string, @CurrentUser() user: any) {
        return this.discoveryService.getRun(id, user.id);
    }

    @Get('runs')
    listRuns(
        @Query('projectId') projectId: string,
        @CurrentUser() user: any,
    ) {
        return this.discoveryService.listRuns(projectId, user.id);
    }
}
