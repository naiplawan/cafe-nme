import { BadRequestException } from '@nestjs/common';

export type ProductInput = {
  name: string;
  price: number;
  categoryId: string | null;
  imageUrl: string | null;
  tileColor: string | null;
  earnsStamp: boolean;
  isActive: boolean;
  modifierGroupIds: string[];
};

// Keep in sync with frontend/src/lib/tile-colors.ts.
const TILE_COLORS = ['amber', 'rose', 'emerald', 'sky', 'violet', 'stone'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

export function parseIdList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 1000 || value.some((id) => typeof id !== 'string' || !UUID.test(id))) {
    throw new BadRequestException(`${field} must be a list of valid ids`);
  }
  const ids = value as string[];
  if (new Set(ids).size !== ids.length) throw new BadRequestException(`${field} must not repeat an id`);
  return ids;
}

export function parseName(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('Name is required');
  const name = value.trim();
  if (!name || name.length > 80) throw new BadRequestException('Name must be 1 to 80 characters');
  return name;
}

export function parseProduct(value: unknown): ProductInput {
  const body = record(value);
  const name = parseName(body.name);
  if (!Number.isSafeInteger(body.price) || (body.price as number) < 0) {
    throw new BadRequestException('Price must be a non-negative integer in satang');
  }
  if (body.categoryId !== null && (typeof body.categoryId !== 'string' || !UUID.test(body.categoryId))) {
    throw new BadRequestException('Category id is invalid');
  }
  if (body.imageUrl !== null && typeof body.imageUrl !== 'string') {
    throw new BadRequestException('Image URL must be a string or null');
  }
  // Optional so older clients that never send it keep working.
  if (body.tileColor !== undefined && body.tileColor !== null && !TILE_COLORS.includes(body.tileColor as string)) {
    throw new BadRequestException('Tile colour is invalid');
  }
  if (typeof body.earnsStamp !== 'boolean' || typeof body.isActive !== 'boolean') {
    throw new BadRequestException('Product flags must be booleans');
  }
  if (
    !Array.isArray(body.modifierGroupIds) ||
    body.modifierGroupIds.some((id) => typeof id !== 'string' || !UUID.test(id))
  ) {
    throw new BadRequestException('Modifier group ids are invalid');
  }
  if (body.modifierGroupIds.length > 100) throw new BadRequestException('Too many modifier groups');
  return {
    name,
    price: body.price as number,
    categoryId: body.categoryId as string | null,
    imageUrl: (body.imageUrl as string | null)?.trim() || null,
    tileColor: (body.tileColor as string | null | undefined) ?? null,
    earnsStamp: body.earnsStamp,
    isActive: body.isActive,
    modifierGroupIds: [...new Set(body.modifierGroupIds as string[])],
  };
}
