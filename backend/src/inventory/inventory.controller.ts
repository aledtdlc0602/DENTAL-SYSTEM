import {
  Controller, Get, Post, Body, Param, Request, Patch, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, PartialType } from '@nestjs/swagger';
import { Roles, R } from '../common/roles.decorator';
import { IsString, IsOptional, IsNumber, Min, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';

class CreateProductDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitCost?: number;
}

class ConsumptionItemDtoBase {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;
}

class UpdateProductDto extends PartialType(CreateProductDto) {}

class RecipeDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumptionItemDtoBase)
  items: ConsumptionItemDtoBase[];
}

class AdjustStockDto {
  @ApiProperty({ enum: ['IN', 'OUT', 'ADJUST'] })
  @IsIn(['IN', 'OUT', 'ADJUST'])
  type: 'IN' | 'OUT' | 'ADJUST';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class ConsumptionItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;
}

@ApiTags('Inventory')
@ApiBearerAuth()
@Roles(...R.ALL_STAFF)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('products')
  @Roles('ACCOUNTANT', 'ASSISTANT')
  @ApiOperation({ summary: 'Crear producto / insumo' })
  createProduct(@Request() req: any, @Body() dto: CreateProductDto) {
    return this.service.createProduct(req.user.clinicId, dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Listar inventario' })
  findProducts(@Request() req: any) {
    return this.service.findProducts(req.user.clinicId);
  }

  @Get('products/low-stock')
  @ApiOperation({ summary: 'Productos bajo stock mínimo' })
  lowStock(@Request() req: any) {
    return this.service.lowStock(req.user.clinicId);
  }

  @Get('valuation')
  @ApiOperation({ summary: 'Valoración de inventario (costo total)' })
  valuation(@Request() req: any) {
    return this.service.inventoryValuation(req.user.clinicId);
  }

  @Patch('products/:id')
  @Roles('ACCOUNTANT')
  @ApiOperation({ summary: 'Editar producto (nombre, mínimo, costo, activo)' })
  updateProduct(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.updateProduct(req.user.clinicId, id, dto);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Kardex: movimientos de stock' })
  @ApiQuery({ name: 'productId', required: false })
  movements(@Request() req: any, @Query('productId') productId?: string) {
    return this.service.movements(req.user.clinicId, productId);
  }

  @Get('recipes')
  @ApiOperation({ summary: 'RF-14: todas las recetas de consumo configuradas' })
  recipes(@Request() req: any) {
    return this.service.allRecipes(req.user.clinicId);
  }

  @Patch('products/:id/stock')
  @Roles('ACCOUNTANT', 'ASSISTANT')
  @ApiOperation({ summary: 'Entrada / salida / ajuste de stock' })
  adjust(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.service.adjustStock(req.user.clinicId, id, dto, req.user.userId);
  }

  @Post('procedures/:procedureId/recipe')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Configurar receta de consumo de un procedimiento (RF-14)' })
  setRecipe(
    @Request() req: any,
    @Param('procedureId') procedureId: string,
    @Body() body: RecipeDto,
  ) {
    return this.service.setConsumptionRecipe(req.user.clinicId, procedureId, body.items || []);
  }

  @Get('procedures/:procedureId/recipe')
  @ApiOperation({ summary: 'Ver receta de consumo de un procedimiento' })
  getRecipe(@Request() req: any, @Param('procedureId') procedureId: string) {
    return this.service.getConsumptionRecipe(req.user.clinicId, procedureId);
  }

  @Post('consume/:procedureId')
  @Roles('DENTIST', 'ASSISTANT')
  @ApiOperation({ summary: 'Ejecutar descargo automático por procedimiento (RF-14)' })
  consume(@Request() req: any, @Param('procedureId') procedureId: string) {
    return this.service.consumeForProcedure(
      req.user.clinicId,
      procedureId,
      req.user.userId,
    );
  }
}
