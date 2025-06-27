/* eslint-disable prettier/prettier */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as schema from "./schema";

@Injectable()
export class DatabaseService {
  constructor(
    @InjectModel(schema.User.name)
    private userModel: Model<schema.UserDocument>,
    @InjectModel(schema.Store.name)
    private storeModel: Model<schema.StoreDocument>,
     ) {}
     get repositories() {
    return {
      userModel: this.userModel,
      storeModel: this.storeModel,
        };
  }
}