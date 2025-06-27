/* eslint-disable prettier/prettier */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "src/database/databaseservice";
import { CreateItemsDto } from "./dto/createItem.dto";
import { ItemType } from "./constants/item.type.enum";
import mongoose, { Model } from "mongoose";
// import { GetItemsDto } from "./dtos/getItems.dto";
// import { SetItemsDto } from "./dtos/setItem.dto";
@Injectable()
export class StoreService {
  constructor(private databaseService: DatabaseService) {}

  async createStoreItems(data: CreateItemsDto) {
    let res = this.databaseService.repositories.storeModel.create(data);
    console.log(data);
    return { message: "sucessfully create Item", data: res };
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