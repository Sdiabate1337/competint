import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';

@Controller('competitors')
export class CompetitorsController {
    constructor(private readonly competitorsService: CompetitorsService) { }

    @Get()
    async findAll(@Query() filters: any) {
        // TODO: Extract organization ID from authenticated user
        const organizationId = 'demo-org-id';
        return this.competitorsService.findAll(organizationId, filters);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const organizationId = 'demo-org-id';
        return this.competitorsService.findOne(id, organizationId);
    }

    @Patch(':id/validate')
    async validateCompetitor(
        @Param('id') id: string,
        @Body() body: { status: 'approved' | 'rejected' },
    ) {
        const organizationId = 'demo-org-id';
        return this.competitorsService.updateValidationStatus(
            id,
            organizationId,
            body.status,
        );
    }

    @Get(':id/similar')
    async findSimilar(@Param('id') id: string, @Query('limit') limit?: number) {
        const organizationId = 'demo-org-id';
        return this.competitorsService.searchSimilar(
            id,
            organizationId,
            limit ? parseInt(limit.toString()) : 10,
        );
    }
}
