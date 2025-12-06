import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('competitors')
@UseGuards(AuthGuard)
export class CompetitorsController {
    constructor(private readonly competitorsService: CompetitorsService) { }

    @Get()
    async findAll(@Query() filters: any, @CurrentUser() user: any) {
        console.log('=== COMPETITORS FINDALL ===');
        console.log('Filters:', JSON.stringify(filters, null, 2));
        console.log('User:', user?.id);

        // Get user's organization from membership
        // For now, we'll pass organizationId as query param from frontend
        const organizationId = filters.organizationId;

        console.log('Organization ID:', organizationId);

        try {
            const result = await this.competitorsService.findAll(organizationId, filters);
            console.log('Result count:', result?.length || 0);
            return result;
        } catch (error) {
            console.error('ERROR in findAll controller:', error);
            throw error;
        }
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @CurrentUser() user: any) {
        // TODO: Get org from user's membership
        const organizationId = 'a75d2ad3-6931-4bb3-9d4e-34af1f25a251';
        return this.competitorsService.findOne(id, organizationId);
    }

    @Patch(':id/validate')
    async validateCompetitor(
        @Param('id') id: string,
        @Body() body: { status: 'approved' | 'rejected' },
        @CurrentUser() user: any,
    ) {
        console.log(`=== VALIDATE COMPETITOR ${id} ===`);
        console.log('Status:', body.status);
        console.log('User:', JSON.stringify(user));

        const organizationId = 'a75d2ad3-6931-4bb3-9d4e-34af1f25a251';
        try {
            return await this.competitorsService.updateValidationStatus(
                id,
                organizationId,
                body.status,
                user?.id,
            );
        } catch (error) {
            console.error('Validation Error:', error);
            throw error;
        }
    }

    @Get(':id/similar')
    async findSimilar(
        @Param('id') id: string,
        @Query('limit') limit?: number,
        @CurrentUser() user?: any,
    ) {
        const organizationId = 'demo-org-id';
        return this.competitorsService.searchSimilar(
            id,
            organizationId,
            limit ? parseInt(limit.toString()) : 10,
        );
    }
}
