import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateProjectDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    target_regions?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    industries?: string[];
}
