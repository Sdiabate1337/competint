import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Post()
    create(
        @Body() createProjectDto: CreateProjectDto,
        @Query('organizationId', ParseUUIDPipe) organizationId: string,
        @CurrentUser() user: any,
    ) {
        return this.projectsService.create(organizationId, user.id, createProjectDto);
    }

    @Get()
    findAll(
        @Query('organizationId') organizationId: string,
        @CurrentUser() user: any,
    ) {
        return this.projectsService.findAll(organizationId, user.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.projectsService.findOne(id, user.id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateProjectDto: UpdateProjectDto,
        @CurrentUser() user: any,
    ) {
        return this.projectsService.update(id, user.id, updateProjectDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.projectsService.remove(id, user.id);
    }
}
