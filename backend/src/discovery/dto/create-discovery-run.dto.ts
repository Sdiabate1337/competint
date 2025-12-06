import { IsString, IsArray, IsOptional, IsNumber, Min, Max, IsUUID } from 'class-validator';

export class CreateDiscoveryRunDto {
    @IsUUID()
    projectId: string;

    @IsArray()
    @IsString({ each: true })
    regions: string[]; // e.g., ["NG", "KE", "BR"]

    @IsArray()
    @IsString({ each: true })
    keywords: string[]; // e.g., ["fintech", "startup"]

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    industries?: string[]; // e.g., ["Fintech", "E-commerce"]

    @IsNumber()
    @Min(10)
    @Max(100)
    @IsOptional()
    maxResults?: number; // default: 50
}
