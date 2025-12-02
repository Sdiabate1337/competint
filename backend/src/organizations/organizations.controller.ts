import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) { }

    @Get()
    async findAll(@Req() req: any) {
        // TODO: Extract user from JWT token
        const userId = req.user?.id || 'demo-user-id';
        return this.organizationsService.findAll(userId);
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req: any) {
        const userId = req.user?.id || 'demo-user-id';
        return this.organizationsService.findOne(id, userId);
    }

    @Post()
    async create(@Body() createOrgDto: { name: string; slug: string }, @Req() req: any) {
        const userId = req.user?.id || 'demo-user-id';
        return this.organizationsService.create(
            createOrgDto.name,
            createOrgDto.slug,
            userId,
        );
    }
}
