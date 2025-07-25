/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {UpdateUserDto} from "./dto/update-user.dto"





import { DatabaseService } from "src/database/databaseservice";

 @Injectable()
 export class UsersService {
   constructor(

    private databaseService: DatabaseService,
   ) {}
  
   async getProfile(userId: string) {
  const user = await this.databaseService.repositories.userModel.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return {
    name: user.name,
    email: user.email,
    ownedCharacters: user.ownedCharacters, // agar empty ho to empty array
  };
}

async updateUserData(userId: string, dto: UpdateUserDto) {
    const { name, characterId, updateCharacterFields } = dto;

    const user = await this.databaseService.repositories.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (name) {
      await this.databaseService.repositories.userModel.updateOne({ _id: userId }, { $set: { name } });
    }

    if (characterId && updateCharacterFields) {
      const characterExists = user.ownedCharacters.some(
        (char) => char.characterId.toString() === characterId
      );

      if (!characterExists) {
        throw new NotFoundException('Character not found in ownedCharacters');
      }

      const updatePayload = Object.entries(updateCharacterFields).reduce((acc, [key, value]) => {
        acc[`ownedCharacters.$.${key}`] = value;
        return acc;
      }, {});

      await this.databaseService.repositories.userModel.updateOne(
        { _id: userId, 'ownedCharacters.characterId': characterId },
        { $set: updatePayload }
      );
    }

    if (!name && !(characterId && updateCharacterFields)) {
      throw new NotFoundException('Nothing to update. Provide name or characterId + updateCharacterFields');
    }

    return { message: 'User updated successfully' };
  }

   

   }

  // 🔍 Get all users


