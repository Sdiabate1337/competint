import { IsString, IsArray, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateDiscoveryDto {
  @IsString()
  projectId: string;

  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @IsArray()
  @IsString({ each: true })
  regions: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxResults?: number;
}
