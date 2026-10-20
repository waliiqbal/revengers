/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {UpdateUserDto} from "./dto/update-user.dto"





import { DatabaseService } from "src/database/databaseservice";
import { SettingsService } from "../settings/settings.service";

 @Injectable()
 export class UsersService {
   constructor(

    private databaseService: DatabaseService,
    private settingsService: SettingsService,
   ) {}
  
   async getProfile(userId: string) {
  const user = await this.databaseService.repositories.userModel.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return { 
  message: 'User registered successfully',
  data: {
    name: user.name,
    email: user.email,
    displayPic: user.displayPic,
    level: user.level,
    trophies: user.trophies,
    skillPoints: user.skillPoints,
    storyStage: user.storyStage,
    trophiesPerLevel: (await this.settingsService.getRewards()).match.trophiesPerLevel,  // admin badal sakta hai
    currentXp: user.currentXp,
    totalXp: user.totalXp,
    gem: user.gem,
    diamond: user.diamond,
    coin: user.coin,
    totalMatch: user.totalMatch,
    won: user.won,
    lost: user.lost,
    kills: user.kills,
    death: user.death,
    assists: user.assists,
    hours: user.hours,
    availableSkill: user.availableSkill,
    
  }
};
}
// ek device token ek hi player ka — dusre account pe same phone login ho to purane se hata do
async saveFcmToken(userId: string, fcmToken: string) {
  await this.databaseService.repositories.userModel.updateMany(
    { fcmToken, _id: { $ne: userId } },
    { $set: { fcmToken: null } },
  );
  await this.databaseService.repositories.userModel.updateOne({ _id: userId }, { $set: { fcmToken } });
  return { message: 'Push token saved', data: { saved: true } };
}

async updateUserData(userId: string, dto: UpdateUserDto) {
  const updatedUser = await this.databaseService.repositories.userModel.findByIdAndUpdate(
    userId,
    { $set: dto },   // dto me jo fields aayengi unhi ko update karega
    { new: true }    // new: true ka matlab updated document return karega
  );

  if (!updatedUser) {
    throw new NotFoundException('User not found');
  }

  return {
    message: 'User updated successfully',
    data: {
      name: updatedUser.name,
      email: updatedUser.email,
      displayPic: updatedUser.displayPic,
      level: updatedUser.level,
      currentXp: updatedUser.currentXp,
      totalXp: updatedUser.totalXp,
      gem: updatedUser.gem,
      diamond: updatedUser.diamond,
      coin: updatedUser.coin,
      totalMatch: updatedUser.totalMatch,
      won: updatedUser.won,
      lost: updatedUser.lost,
      kills: updatedUser.kills,
      death: updatedUser.death,
      assists: updatedUser.assists,
      hours: updatedUser.hours,
      availableSkill: updatedUser.availableSkill,
    }
  };
}

}

  // 🔍 Get all users


