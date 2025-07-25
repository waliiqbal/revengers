/* eslint-disable prettier/prettier */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "src/database/databaseservice";
import {PurchaseItemDto} from "../payment/dto/purchase-item.dto"

@Injectable()
export class paymentService {
  constructor(private databaseService: DatabaseService) {}

async purchaseItem(userId: string, purchaseItemDto: PurchaseItemDto) {
    const { itemId, amount, paymentMethod } = purchaseItemDto;

    // 1. Store item fetch karo
    const item: any = await this.databaseService.repositories.storeModel.findById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    
  

    // 2. User fetch karo
    const user = await this.databaseService.repositories.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 3. Payment save karo
    await this.databaseService.repositories.paymentModel.create({
      userId,
      itemId,
      amount,
      paymentMethod,
    });

    // 4. Owned character me item push karo
    user.ownedCharacters.push({
      characterId: item._id,
      name: item.name,
      maxHealth: item.maxHealth,
      attack: item.attack,
      defense: item.defense,
      speed: item.speed,
      specialPower: item.specialPower,
      level: 1,
      experience: 0,
    });

    await user.save();

    return {
      message: 'Item purchased successfully',
      item: item.name,
    };
  }
}
