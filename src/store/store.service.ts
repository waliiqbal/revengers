/* eslint-disable prettier/prettier */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "src/database/databaseservice";
import { CreateStoreDto } from "./dto/createItem.dto";
// import { ItemType } from "./constants/item.type.enum";
import mongoose, { Model } from "mongoose";
// import { GetItemsDto } from "./dtos/getItems.dto";
// import { SetItemsDto } from "./dtos/setItem.dto";
@Injectable()
export class StoreService {
  constructor(private databaseService: DatabaseService) {}

async createStoreItems(data: CreateStoreDto) {
  const res = await this.databaseService.repositories.storeModel.create(data);
  return { message: "successfully create Item", data: res };
}

  async listAllStoreItems() {
    
    const storeItems = await this.databaseService.repositories.storeModel.find({isActive: true});

    const response = {
      message: "fetch sucessfully StoreItems",
      data: {
        storeItems
      },
    };

    return response;
  }
}