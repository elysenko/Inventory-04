import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { ItemsService, ItemDetailView, ItemView } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  /** Readable by both roles — the clerk catalog view depends on it. */
  @Get()
  findAll(@Query() query: QueryItemsDto): Promise<ItemView[]> {
    return this.items.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ItemDetailView> {
    return this.items.findOne(id);
  }

  @Roles(Role.manager)
  @Post()
  create(@Body() dto: CreateItemDto): Promise<ItemView> {
    return this.items.create(dto);
  }

  @Roles(Role.manager)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<ItemView> {
    return this.items.update(id, dto);
  }

  @Roles(Role.manager)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ id: string; deleted: true }> {
    return this.items.remove(id);
  }
}
