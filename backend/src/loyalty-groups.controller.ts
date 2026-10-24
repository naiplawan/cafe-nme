import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiStandardErrors } from './common/api-errors.decorator.js';
import { InternalApiGuard } from './internal-api.guard.js';
import { LoyaltyGroupsService } from './loyalty-groups.service.js';

class CreateLoyaltyGroupDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() actorStaffId!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  shopIds!: string[];
}
class BranchOptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() stampGoal!: number;
  @ApiProperty() stampExpiryMonths!: number;
  @ApiProperty({ format: 'uuid', nullable: true }) groupId!: string | null;
}
class IssuerLiabilityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() outstandingRewards!: number;
}
class GroupDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [IssuerLiabilityDto] }) shops!: IssuerLiabilityDto[];
}
class GroupSettingsDto {
  @ApiProperty({ type: [BranchOptionDto] }) shops!: BranchOptionDto[];
  @ApiProperty({ type: GroupDto, nullable: true }) group!: GroupDto | null;
}
class GroupIdDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
}
@ApiStandardErrors()
@ApiTags('loyalty-groups')
@ApiSecurity('internal-api-token')
@Controller('v1/shops/:shopId/loyalty-group')
@UseGuards(InternalApiGuard)
export class LoyaltyGroupsController {
  constructor(@Inject(LoyaltyGroupsService) private readonly groups: LoyaltyGroupsService) {}
  @Get()
  @ApiOkResponse({ type: GroupSettingsDto })
  get(@Param('shopId', new ParseUUIDPipe()) shopId: string, @Query('actorStaffId', new ParseUUIDPipe()) actor: string) {
    return this.groups.get(shopId, actor);
  }
  @Post()
  @ApiCreatedResponse({ type: GroupIdDto })
  create(@Param('shopId', new ParseUUIDPipe()) shopId: string, @Body() body: CreateLoyaltyGroupDto) {
    return this.groups.create(shopId, body.actorStaffId, { name: body.name, shopIds: body.shopIds });
  }
}
