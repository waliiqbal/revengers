/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { SECTION_PRICE_CURRENCY, SHOP_SECTIONS } from './shop-item.schema';
import { SHOP_DEFAULTS } from './shop.defaults';
import { UpdateShopItemDto } from './dto/shop.dto';

@Injectable()
export class ShopService {
  private defaultsChecked = false;

  constructor(private databaseService: DatabaseService) {}

  private get shopModel() {
    return this.databaseService.repositories.shopItemModel;
  }

  // pehli baar: game ki values se store bharo. Jo card pehle se hai usko kabhi overwrite nahi karte.
  private async ensureDefaults() {
    if (this.defaultsChecked) return;
    try {
      await this.shopModel.bulkWrite(
        SHOP_DEFAULTS.map((d) => ({
          updateOne: {
            filter: { section: d.section, slot: d.slot },
            update: { $setOnInsert: { ...d, description: d.description || '', iosProductId: '', androidProductId: '', active: true } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    } catch (err) {
      // do request ek saath aayen to dusra "duplicate" pe fail hota hai — card ban chuka hai, theek hai
      if (err?.code !== 11000 && !err?.writeErrors?.every?.((e) => e.code === 11000)) throw err;
    }
    this.defaultsChecked = true;
  }

  private view(item: any) {
    return {
      _id: String(item._id),
      section: item.section,
      slot: item.slot,
      title: item.title || '',
      amount: item.amount || 0,
      description: item.description || '',
      price: item.price || 0,
      priceCurrency: SECTION_PRICE_CURRENCY[item.section],
      iosProductId: item.iosProductId || '',
      androidProductId: item.androidProductId || '',
      active: item.active !== false,
      updatedAt: item.updatedAt,
    };
  }

  private async grouped() {
    await this.ensureDefaults();
    const items = await this.shopModel.find().sort({ section: 1, slot: 1 }).lean();
    const data: Record<string, any[]> = Object.fromEntries(SHOP_SECTIONS.map((s) => [s, []]));
    for (const item of items) data[item.section]?.push(this.view(item));
    return data;
  }

  // 🎮 game: saare cards (active=false wale game chhupa deta hai)
  async catalog() {
    return { message: 'Store catalog', data: await this.grouped() };
  }

  // 🔐 admin dashboard
  async adminList() {
    const data = await this.grouped();
    const last = await this.shopModel.findOne({ updatedBy: { $ne: null } }).sort({ updatedAt: -1 }).populate('updatedBy', 'email').lean();
    return {
      message: 'Store items',
      data: {
        sections: data,
        lastChange: last ? { at: last.updatedAt, by: (last.updatedBy as any)?.email || '' } : null,
      },
    };
  }

  async update(adminId: string, id: string, dto: UpdateShopItemDto) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid store item id');
    const item = await this.shopModel.findById(id).lean();
    if (!item) throw new NotFoundException('Store item not found');

    // coins tab dollar me (4.99), baaki tabs poore number me
    if (dto.price !== undefined && item.section !== 'coins' && !Number.isInteger(dto.price)) {
      throw new BadRequestException('Price must be a whole number for this tab');
    }

    const changes: any = { ...dto, updatedBy: new Types.ObjectId(adminId) };
    for (const key of ['title', 'description', 'iosProductId', 'androidProductId']) {
      if (typeof changes[key] === 'string') changes[key] = changes[key].trim();
    }

    // ek product ID sirf ek card pe ho sakta hai (warna store galat cheez de dega)
    for (const key of ['iosProductId', 'androidProductId']) {
      const value = changes[key];
      if (!value) continue;
      const taken = await this.shopModel.findOne({ _id: { $ne: item._id }, [key]: value }).lean();
      if (taken) {
        throw new BadRequestException(`${key === 'iosProductId' ? 'iOS' : 'Android'} product ID "${value}" is already used by ${taken.section} card ${taken.slot}`);
      }
    }

    const updated = await this.shopModel.findByIdAndUpdate(item._id, { $set: changes }, { new: true }).lean();
    return { message: 'Store item saved', data: this.view(updated) };
  }

  // values wapas game wali; product IDs nahi mitate (woh store accounts se aate hain)
  async resetToDefaults(adminId: string) {
    await this.ensureDefaults();
    await this.shopModel.bulkWrite(
      SHOP_DEFAULTS.map((d) => ({
        updateOne: {
          filter: { section: d.section, slot: d.slot },
          update: { $set: { title: d.title, amount: d.amount, description: d.description || '', price: d.price, active: true, updatedBy: new Types.ObjectId(adminId) } },
        },
      })),
    );
    return { message: 'Store reset to the game defaults (product IDs kept)', data: await this.grouped() };
  }
}
