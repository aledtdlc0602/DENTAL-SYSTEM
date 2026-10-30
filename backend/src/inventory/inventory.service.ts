import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  createProduct(
    clinicId: string,
    data: {
      name: string;
      sku?: string;
      unit?: string;
      stock?: number;
      minStock?: number;
      unitCost?: number;
    },
  ) {
    return this.prisma.product.create({
      data: {
        clinicId,
        name: data.name,
        sku: data.sku,
        unit: data.unit || 'UND',
        stock: data.stock ?? 0,
        minStock: data.minStock ?? 0,
        unitCost: data.unitCost ?? 0,
      },
    });
  }

  findProducts(clinicId: string) {
    return this.prisma.product.findMany({
      where: { clinicId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async adjustStock(
    clinicId: string,
    productId: string,
    data: { type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string; referenceId?: string },
    userId?: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, clinicId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const qty = Number(data.quantity);
    if (qty < 0) throw new BadRequestException('Cantidad inválida');

    let newStock = Number(product.stock);
    if (data.type === 'IN') newStock += qty;
    else if (data.type === 'OUT') {
      if (newStock < qty) throw new BadRequestException(`Stock insuficiente de ${product.name}`);
      newStock -= qty;
    } else {
      newStock = qty;
    }

    await this.prisma.stockMovement.create({
      data: {
        clinicId,
        productId,
        type: data.type,
        quantity: qty,
        reason: data.reason,
        referenceId: data.referenceId,
        createdById: userId,
      },
    });

    return this.prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });
  }

  /** Configurar receta de consumo de un procedimiento (RF-14) */
  async setConsumptionRecipe(
    clinicId: string,
    procedureId: string,
    items: { productId: string; quantity: number }[],
  ) {
    const proc = await this.prisma.procedure.findFirst({
      where: { id: procedureId, clinicId },
    });
    if (!proc) throw new NotFoundException('Procedimiento no encontrado');

    // Reemplazar receta completa
    await this.prisma.procedureConsumption.deleteMany({ where: { procedureId } });

    if (!items?.length) return [];

    const created = [];
    for (const item of items) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, clinicId },
      });
      if (!product) continue;
      const c = await this.prisma.procedureConsumption.create({
        data: {
          procedureId,
          productId: item.productId,
          quantity: item.quantity,
        },
        include: { product: true },
      });
      created.push(c);
    }
    return created;
  }

  getConsumptionRecipe(clinicId: string, procedureId: string) {
    return this.prisma.procedureConsumption.findMany({
      where: { procedureId, product: { clinicId } },
      include: { product: true },
    });
  }

  /** RF-14: descargo automático al completar procedimiento */
  async consumeForProcedure(
    clinicId: string,
    procedureId: string,
    userId?: string,
    referenceId?: string,
  ) {
    const recipes = await this.prisma.procedureConsumption.findMany({
      where: { procedureId },
      include: { product: true, procedure: { select: { name: true } } },
    });

    const results = [];
    for (const r of recipes) {
      if (r.product.clinicId !== clinicId) continue;
      try {
        const p = await this.adjustStock(
          clinicId,
          r.productId,
          {
            type: 'OUT',
            quantity: Number(r.quantity),
            reason: `Descargo automático: ${r.procedure?.name ?? 'procedimiento'}`,
            referenceId,
          },
          userId,
        );
        results.push({ productId: r.productId, name: r.product.name, quantity: r.quantity, ok: true, stock: p.stock });
      } catch (e: any) {
        results.push({ productId: r.productId, name: r.product.name, error: e.message, ok: false });
      }
    }
    return results;
  }

  async updateProduct(clinicId: string, id: string, data: { name?: string; sku?: string; unit?: string; minStock?: number; unitCost?: number; isActive?: boolean }) {
    const p = await this.prisma.product.findFirst({ where: { id, clinicId } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return this.prisma.product.update({ where: { id }, data });
  }

  movements(clinicId: string, productId?: string, limit = 100) {
    return this.prisma.stockMovement.findMany({
      where: { clinicId, ...(productId ? { productId } : {}) },
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  /** Todas las recetas de consumo de la clínica (para la pantalla de configuración RF-14). */
  allRecipes(clinicId: string) {
    return this.prisma.procedure.findMany({
      where: { clinicId, isActive: true, consumptions: { some: {} } },
      select: { id: true, name: true, consumptions: { include: { product: { select: { id: true, name: true, unit: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  lowStock(clinicId: string) {
    return this.prisma.product.findMany({
      where: {
        clinicId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    }).then((list) =>
      list.filter((p) => Number(p.stock) <= Number(p.minStock)),
    );
  }

  async inventoryValuation(clinicId: string) {
    const products = await this.findProducts(clinicId);
    let totalCost = 0;
    const lines = products.map((p) => {
      const value = Number(p.stock) * Number(p.unitCost);
      totalCost += value;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: Number(p.stock),
        unitCost: Number(p.unitCost),
        value,
        low: Number(p.stock) <= Number(p.minStock),
      };
    });
    return { totalCost, products: lines };
  }
}
