/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schema/user.schema';
import { Model } from 'mongoose';;
import { UpdateUserDto } from './dto/update-user.dto'
import { DatabaseService } from "src/database/databaseservice";

 @Injectable()
 export class UsersService {
   constructor(

    private databaseService: DatabaseService,
   ) {}
   

  // 🔍 Get all users
  async findAll(): Promise<User[]> {
    return this.databaseService.repositories.userModel.find().exec();
  }

  // 🔍 Get user by ID
  async findById(id: string): Promise<User> {
    const user = await this.databaseService.repositories.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  // ✏️ Update user by ID
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const updatedUser = await this.databaseService.repositories.userModel.findByIdAndUpdate(
      id,
      updateUserDto,
      { new: true }
    ).exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return updatedUser;
  }

  // 🗑️ Delete user by ID
  async delete(id: string): Promise<{ message: string }> {
    const result = await this.databaseService.repositories.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return { message: 'User deleted successfully' };
  }
}
