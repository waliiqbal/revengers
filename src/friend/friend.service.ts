/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';


import { Types,  } from 'mongoose';





import { DatabaseService } from "src/database/databaseservice";

 @Injectable()
 export class FriendService {
   constructor(

    private databaseService: DatabaseService,
   ) {}

async sendFriendRequest(senderId: string, receiverId: string) {
  // 1. sender fetch
  const sender = await this.databaseService.repositories.userModel.findById(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  // 2. receiver fetch
  const receiver = await this.databaseService.repositories.userModel.findById(receiverId);
  if (!receiver) {
    throw new Error('Receiver not found');
  }

   const existingRequest = await this.databaseService.repositories.friendModel.findOne({
    senderId,
    receiverId,
    status: 'open'   // yahan tumhara schema me jo field hai use check karo
  });

   if (existingRequest) {
    return {
      message: 'You are already friend',
      data: existingRequest,
    };
  }

     const Request = await this.databaseService.repositories.friendModel.findOne({
    senderId,
    receiverId,
    status: 'pending',
    isDeleted: false
       
  });

   if (Request) {
    return {
      message: 'You have already sent a friend request',
      data: Request,
    };
  }

   // 5. check if there was a declined/removed request before
  const oldClosedRequest = await this.databaseService.repositories.friendModel.findOne({
    $or: [
      { senderId, receiverId },
      { senderId: receiverId, receiverId: senderId }
    ],
    status: "close",
    isDeleted: true,
  });

  if (oldClosedRequest) {
    // update that request instead of creating new
    (oldClosedRequest.senderId as any) = senderId;
    (oldClosedRequest.receiverId as any) = receiverId;
    oldClosedRequest.senderName = sender.name;
    oldClosedRequest.receiverName = receiver.name;
    oldClosedRequest.status = "pending";
    oldClosedRequest.isDeleted = false;

    await oldClosedRequest.save();

    return {
      message: "Friend request re-sent successfully",
      data: oldClosedRequest,
    };
  }
  // 3. friend request create
  const friendRequest = await this.databaseService.repositories.friendModel.create({
    senderId,
    receiverId,
    senderName: sender.name,
    receiverName: receiver.name,
    status: "pending",       // default pending
    isDeleted: false,   
    
  });

  return {
    message: 'Friend request sent successfully',
    data: friendRequest,
  };
}

async getFriendRequests(
  userId: string,
  type: string,
  page: number,
  limit: number
) {
  let filter = {};
  let populateField = '';

  if (type === 'get-friend-request') {
    filter = { receiverId: userId, status: "pending", isDeleted: false };
    populateField = 'senderId';
  } else if (type === 'my-sending-request') {
    filter = { senderId: userId, status: "pending", isDeleted: false };
    populateField = 'receiverId';
  } else {
    throw new Error('Invalid type');
  }

  // skip calculate
  const skip = (page - 1) * limit;

  // query with pagination
  const requests = await this.databaseService.repositories.friendModel
    .find(filter)
    .populate({
      path: populateField,
      select: '_id name displayPic level status',
      model: 'User',
    })
    .skip(skip)
    .limit(limit);

  // total count for pagination meta
  const totalRequests = await this.databaseService.repositories.friendModel.countDocuments(filter);

  // clean response
  const userDetails = requests.map((req: any) => {
    const user = req[populateField];
    return {
      id: user._id,
      name: user.name,
      displayPic: user.displayPic,
      level: user.level,
      status: user.status,
    };
  });

  return {
    message: 'Friend requests fetched successfully',
    data: userDetails,
    pagination: {
      total: totalRequests,
      page,
      limit,
      totalPages: Math.ceil(totalRequests / limit),
    },
  };
}



   async acceptRequest(receiverId: string, body: any) {
  const { id, type } = body; // id = senderId

  if (type !== 'accept' && type !== 'reject') {
    throw new BadRequestException('Invalid type');
  }

  let updateData = {};

  if (type === 'accept') {
    updateData = { status: 'open' };
  } else if (type === 'reject') {
    updateData = { status: 'close', isDeleted: true };
  }

  const request = await this.databaseService.repositories.friendModel.findOneAndUpdate(
    { senderId: id, receiverId: receiverId, status: 'pending', isDeleted: false },
    { $set: updateData },
    { new: true },
  );

  if (!request) {
    throw new BadRequestException('Request not found or already processed');
  }

  return {
    message:
      type === 'accept'
        ? 'Friend request accepted'
        : 'Friend request rejected',
    data: request,
  };
}

async declineFriendRequest(senderId: string, receiverId: string) {

  console.log(senderId)
  console.log(receiverId)

  const friend = await this.databaseService.repositories.friendModel.findOneAndUpdate(
    { senderId: senderId, receiverId: receiverId },
    { $set: { status: "close" , isDeleted: false} },
    { new: true }
  );

  if (!friend) {
    throw new NotFoundException("Friend request not found");
  }

  return { message: "Friend request declined successfully" };
}

// Service
async getFriends(userId: string, page: number, limit: number, search?: string) {
  const skip = (page - 1) * limit;

  console.log("UserId:", userId);

  // ✅ ab sirf status "open" wale friends ayenge
  const matchStage = {
    status: "open",
    isDeleted: false,
    $or: [
      { senderId: userId },
      { receiverId: userId }
    ]
  };

  console.log("Match Stage:", JSON.stringify(matchStage, null, 2));

  const pipeline: any[] = [
    { $match: matchStage },

    // ✅ sender details (string → ObjectId conversion)
    {
      $lookup: {
        from: "users",
        let: { senderObjId: { $toObjectId: "$senderId" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$senderObjId"] } } }
        ],
        as: "sender"
      }
    },
    { $unwind: "$sender" },

    // ✅ receiver details (string → ObjectId conversion)
    {
      $lookup: {
        from: "users",
        let: { receiverObjId: { $toObjectId: "$receiverId" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$receiverObjId"] } } }
        ],
        as: "receiver"
      }
    },
    { $unwind: "$receiver" },

    // ✅ decide friend field
    {
      $addFields: {
        friend: {
          $cond: [
            { $eq: [{ $toString: "$sender._id" }, userId] },
            "$receiver",
            "$sender"
          ]
        }
      }
    }
  ];

  // optional search
  if (search) {
    pipeline.push({
      $match: {
        "friend.name": { $regex: search, $options: "i" }
      }
    });
    console.log("Search Applied:", search);
  }

  // projection
  pipeline.push({
    $project: {
      _id: 0,
      id: "$friend._id",
      name: "$friend.name",
      displayPic: "$friend.displayPic",
      level: "$friend.level",
      status: "$status"
    }
  });

  // pagination
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  console.log("Final Pipeline:", JSON.stringify(pipeline, null, 2));

  // aggregation
  const friends = await this.databaseService.repositories.friendModel.aggregate(pipeline);
  console.log("Friends Result:", JSON.stringify(friends, null, 2));

  // total count
  let total: number;

  if (!search) {
    total = await this.databaseService.repositories.friendModel.countDocuments(matchStage);
    console.log("Total (no search):", total);
  } else {
    const totalResult = await this.databaseService.repositories.friendModel.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          let: { senderObjId: { $toObjectId: "$senderId" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$senderObjId"] } } }
          ],
          as: "sender"
        }
      },
      { $unwind: "$sender" },
      {
        $lookup: {
          from: "users",
          let: { receiverObjId: { $toObjectId: "$receiverId" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$receiverObjId"] } } }
          ],
          as: "receiver"
        }
      },
      { $unwind: "$receiver" },
      {
        $addFields: {
          friend: {
            $cond: [
              { $eq: [{ $toString: "$sender._id" }, userId] },
              "$receiver",
              "$sender"
            ]
          }
        }
      },
      {
        $match: {
          "friend.name": { $regex: search, $options: "i" }
        }
      },
      { $count: "total" }
    ]);

    total = totalResult[0]?.total || 0;
    console.log("Total Result (with search):", total);
  }

  return {
    message: "Friends fetched successfully",
    data: friends,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}


async getAllUsers(currentUserId: string, page: number, limit: number, search?: string) {
  const skip = (page - 1) * limit;

  // 1. query build karo
  const query: any = { _id: { $ne: currentUserId } }; // apna khud ka record skip
  if (search) {
    query.name = { $regex: search, $options: "i" }; // optional search
  }

  // 2. parallel fetch karo: users + total count
  const [users, total] = await Promise.all([
    this.databaseService.repositories.userModel
      .find(query)
      .select("_id name displayPic level")
      .skip(skip)
      .limit(limit),

    this.databaseService.repositories.userModel.countDocuments(query),
  ]);

  // 3. un 10 users ki IDs nikalo
  const userIds = users.map(u => u._id.toString());

  // 4. relations fetch karo sirf unhi 10 users ke liye
  const relations = await this.databaseService.repositories.friendModel.find({
    isDeleted: false, // ✅ sirf active documents
    $or: [
      { senderId: currentUserId, receiverId: { $in: userIds } },
      { receiverId: currentUserId, senderId: { $in: userIds } },
    ],
  });

  // 5. ab final response build karo
  const data = users.map(user => {
    const relation = relations.find(r =>
     (r.senderId === currentUserId as any && r.receiverId === (user._id as any).toString()) ||
      (r.receiverId === currentUserId as any && r.senderId === (user._id as any).toString())   
    );

    let relationStatus = "open"; // default: koi relation hi nahi

    if (relation) {
      if (relation.status === "pending") {
        if (relation.senderId === currentUserId as any) {
          relationStatus = "requested"; 
        } else {
          relationStatus = "pending";   
        }
      } else if (relation.status === "open") {
        relationStatus = "close"; 
      }
     
    }

    return {
      id: user._id,
      name: user.name,
      displayPic: user.displayPic,
      level: user.level,
      relationStatus,
    };
  });

  // 6. final response
  return {
    message: "Users fetched successfully",
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async removeFriend(currentUserId: string, otherUserId: string) {
  console.log("Current User:", currentUserId);
  console.log("Other User:", otherUserId);

  // ✅ document find karo
  const friend = await this.databaseService.repositories.friendModel.findOneAndUpdate(
    {
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId }
      ],
      status: "open",
      isDeleted: false
    },
    {
      $set: { isDeleted: true }   // 👈 yahan soft delete kar rahe hain
    },
    { new: true }
  );

  if (!friend) {
    throw new NotFoundException("Friendship not found or already removed");
  }

  return { message: "Friend removed successfully" };
}


}




