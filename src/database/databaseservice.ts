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
    @InjectModel(schema.Game.name)
    private gameModel: Model<schema.GameDocument>,
    @InjectModel(schema.Payment.name)
    private paymentModel: Model<schema.PaymentDocument>,
    @InjectModel(schema.Friend.name)
    private friendModel: Model<schema.FriendDocument>,
    @InjectModel(schema.Clan.name)
    private clanModel: Model<schema.ClanDocument>,
    @InjectModel(schema.clanRequest.name)
    private clanRequestModel: Model<schema.clanRequestDocument>,
    @InjectModel(schema.Setting.name)
    private settingModel: Model<schema.SettingDocument>,
    @InjectModel(schema.NotificationLog.name)
    private notificationModel: Model<schema.NotificationLogDocument>,
    @InjectModel(schema.SupportTicket.name)
    private supportTicketModel: Model<schema.SupportTicketDocument>,

     ) {}
     get repositories() {
    return {
      userModel: this.userModel,
      storeModel: this.storeModel,
      paymentModel: this.paymentModel,
      gameModel: this.gameModel,
      friendModel: this.friendModel,
      clanModel: this.clanModel,
      clanRequestModel: this.clanRequestModel,
      settingModel: this.settingModel,
      notificationModel: this.notificationModel,
      supportTicketModel: this.supportTicketModel,

        };
  }
}