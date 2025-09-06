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
    
  const storeItems = await this.databaseService.repositories.storeModel.find();
  

    const response = {
      message: "fetch sucessfully StoreItems",
      data: {
        storeItems
      },
    };

    return response;
  }
async unlockCharacter(body: any) {
  const { shortcode, unlock } = body;

  // character ko find karo aur unlock field update karo
  const updatedCharacter = await this.databaseService.repositories.storeModel.findOneAndUpdate(
    { shortcode },                  // jis character ka shortcode match kare
    { $set: { unlock } },           // body se jo unlock aya use update karo
    { new: true }                   // updated document return kare
  );



  if (!updatedCharacter) {
    return {
      message: 'Character not found',
    };
  }

  return {
    message: 'Character unlock status updated successfully',
    data: updatedCharacter,
  };
}
}