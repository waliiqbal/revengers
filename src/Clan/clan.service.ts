/* eslint-disable prettier/prettier */
import { Injectable, BadRequestException } from '@nestjs/common';


import { Types  } from 'mongoose';





import { DatabaseService } from "src/database/databaseservice";

 @Injectable()
 export class ClanService {
  constructor(

  private databaseService: DatabaseService,
) {}
 async createClan(body: any, userId: string) {
    const { clanName } = body;

    console.log(userId)

    // check: clan name already exist?
    const existing = await this.databaseService.repositories.clanModel.findOne({ clanName });
    if (existing) {
      throw new BadRequestException("Clan name already taken");
    }

    const clan = new this.databaseService.repositories.clanModel({
      clanName,
      leader: new Types.ObjectId(userId),
      members: [new Types.ObjectId(userId)],
      
    });

    const savedClan = await clan.save();

  return {
      message: "Clan created successfully",
      data: {
        id: savedClan._id,
        clanName: savedClan.clanName,
        clanDisplayPic: savedClan.clanDisplayPic,
        clanLevel: savedClan.clanLevel,
        clanStatus: savedClan.clanStatus,
        clanTotalWin: savedClan.clanTotalWin,
        clanTotalLose: savedClan.clanTotalLose,
        clanCurrentMembers: savedClan.clanCurrentMembers,
        clanMembersMaxLimit: savedClan.clanMembersMaxLimit,
        leader: savedClan.leader,
        members: savedClan.members,
        
      }
    };
  }
async sendClanRequest(clanId: string, userId: string) {

    

    // check clan exist karta hai ya nahi
    const clan = await this.databaseService.repositories.clanModel.findById(clanId);
    if (!clan) {
      throw new BadRequestException("Clan not found");
    }

    // check user already member to nahi hai
    if (clan.members.some(memberId => memberId.toString() === userId)) {
      throw new BadRequestException("You are already a member of this clan");
    }

  const user = await this.databaseService.repositories.userModel.findById(userId)
  if (!user) {
    throw new Error("User not found");
  }

   
    const existing = await this.databaseService.repositories.clanRequestModel.findOne({
      clanId: new Types.ObjectId(clanId),
      senderId: new Types.ObjectId(userId),
      status: "pending",
      isDeleted: false
      
    });

    if (existing) {
      throw new BadRequestException("You already sent a request to this clan");
    }

    // new request create
    const newRequest = new this.databaseService.repositories.clanRequestModel({
      clanId: new Types.ObjectId(clanId),
      senderId: new Types.ObjectId(userId),
      status: "pending",
      isDeleted: false,
      senderName: user.name, 
      clanName: clan.clanName
    });

    const savedRequest = await newRequest.save();

    return {
      message: "Clan request sent successfully",
      data: {
        RequestId: savedRequest._id,
        clanId: savedRequest.clanId,
        senderId: savedRequest.senderId,
        status: savedRequest.status,
       
      }
    };
  }

  async handleClanRequest(requestId: string, leaderId: string, type: string) {
  // Step 1: request fetch karo
  const request = await this.databaseService.repositories.clanRequestModel.findById(requestId);
  if (!request) {
    throw new Error("Clan request not found");
  }

  if (!(request.status === "pending" && request.isDeleted === false)) {
  throw new BadRequestException("This request is not in list");
}

  if (type !== 'accept' && type !== 'reject') {
    throw new BadRequestException('Invalid type');
  }
  // Step 2: clan fetch karo aur leader check karo
  const clan = await this.databaseService.repositories.clanModel.findById(request.clanId);
  if (!clan) {
     throw new BadRequestException("Clan not found");
  }

  if (clan.leader.toString() !== leaderId) {
     throw new BadRequestException("Only clan leader can accept/decline requests");
  }

  // Step 3: decision apply karo
  if (type === "accept") {
    // check limit
    if (clan.clanCurrentMembers >= clan.clanMembersMaxLimit) {
      throw new Error("Clan is full");
    }

    // user ko members list me add karo
    clan.members.push(request.senderId);
    clan.clanCurrentMembers += 1;
    await clan.save();

    request.status = "close";
    await request.save();

  } else if (type === "reject") {
    request.status = "open";
    request.isDeleted = true;
    await request.save();
  }

  // Step 4: response return karo
  return {
    success: true,
    message: `Request ${type}`,
  };
}

async declineClanRequestBySender(requestId: string, senderId: string) {
  // Step 1: request fetch karo
  const request = await this.databaseService.repositories.clanRequestModel.findById(requestId);
  if (!request) {
    throw new BadRequestException("Clan request not found");
  }

  // Step 2: check karo ke ye request isi sender ki hai
  if (request.senderId.toString() !== senderId) {
    throw new BadRequestException("You can only cancel your own request");
  }

  // Step 3: agar request already accepted hai to cancel nahi ho sakti
  if (request.status === "close") {
   throw new BadRequestException("Request already accepted, cannot cancel");
  }

  if (request.status === "open" && request.isDeleted === true)  {
   throw new BadRequestException("you have already cancel your request");
  }

  // Step 4: request ko decline/cancel mark kar do
  request.status = "open";
  request.isDeleted = true;
  await request.save();

  // Step 5: response return karo
  return {
    success: true,
    message: "Request cancelled by sender",
  };
}

async getClanRequests(clanId: string, userId: string, page , limit ) {
  // Step 1: clan fetch karo
  const clan = await this.databaseService.repositories.clanModel.findById(clanId);
  if (!clan) throw new Error("Clan not found");

  // Step 2: sirf leader ko allow karo
  if (clan.leader.toString() !== userId) {
    throw new Error("Only clan leader can view requests");
  }

  const skip = (page - 1) * limit;

  // Step 3: aggregation pipeline
  const requests = await this.databaseService.repositories.clanRequestModel.aggregate([
    {
      $match: {
        clanId: new Types.ObjectId(clanId),
        isDeleted: false,
        status: "pending",
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "users", // 👈 tumhari users collection ka naam
        localField: "senderId",
        foreignField: "_id",
        as: "sender",
      },
    },
    { $unwind: "$sender" }, // sender array ko normal object bana diya
    {
     $project: {
    _id: 0,                
    status: 1,             
    senderId: "$sender._id",
    name: "$sender.name",
    displayPic: "$sender.displayPic",
     level: "$sender.level",
}
    },
  ]);

  // Step 4: total count (for pagination)
  const total = await this.databaseService.repositories.clanRequestModel.countDocuments({
    clanId,
    isDeleted: false,
    status: "pending",
  });

  // Step 5: response return karo
  return {
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: requests,
  };
}

async getClanFriends(clanId: string, userId: string, page: number, limit: number ) {
  const skip = (page - 1) * limit;

  // 1. clan fetch karo
  const clan = await this.databaseService.repositories.clanModel.findById(clanId);
  if (!clan) {
    throw new BadRequestException("Clan not found");
  }

  // 2. check karo kya user clan ka member hai
  const isMember = clan.members.some((m: any) => m.toString() === userId);

if (!isMember) {
  throw new BadRequestException("Only clan members can view this list");
}

// 3. members list banao (direct clan.members se)
const memberIds = clan.members;
  // 4. users fetch karo with pagination
  const [users, total] = await Promise.all([
    this.databaseService.repositories.userModel
      .find({ _id: { $in: memberIds } })
      .select("_id name displayPic level")
      .skip(skip)
      .limit(limit),

    this.databaseService.repositories.userModel.countDocuments({ _id: { $in: memberIds } }),
  ]);

  // 5. response return karo
  return {
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: users,
  };
}

async getClansWithStatus(
  userId: string,
  page: number,
  limit: number,
  search?: string
) {
  const query: any = {};
  if (search) {
    query.clanName = { $regex: search, $options: "i" };
  }

  const clans = await this.databaseService.repositories.clanModel
    .find(query)
    .sort({ clanTotalWin: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const results = [];

  for (const clan of clans) {
    let status = "open"; // default

    const userObjectId = new Types.ObjectId(userId);

    // ✅ Leader check
    if (clan.leader?.toString() === userId) {
      status = "leader";
    }
    // ✅ Member check
    else if (clan.members.some(m => m.toString() === userId)) {
      status = "member";
    }
    // ✅ Request check
    else {
      const request = await this.databaseService.repositories.clanRequestModel.findOne({
        clanId: clan._id,
        senderId: userObjectId
      });

      if (request) {
        if (request.status === "pending") {
          status = "pending";
        } else if (request.status === "open") {
          status = "open"; // rejected → still open for new request
        } else if (request.status === "close") {
          // ✅ close = request accepted → banda ab member hai
          status = "member";
        }
      }
    }

   results.push({
      clanId: clan._id,
      clanName: clan.clanName,
      clanDisplayPic: clan.clanDisplayPic,
      clanLevel: clan.clanLevel,
      clanStatus: clan.clanStatus,
      clanTotalWin: clan.clanTotalWin,
      clanTotalLose: clan.clanTotalLose,
      clanCurrentMembers: clan.clanCurrentMembers,
      clanMembersMaxLimit: clan.clanMembersMaxLimit,
      leader: clan.leader,
      status,
    });
  }

  const total = await this.databaseService.repositories.clanModel.countDocuments(query);

  return {
    message: "Clans fetched successfully",
    data: results,
    pagination: {
      total,
      page,
      limit
    }
  };
}

async getMyClan(userId: string) {
  const userObjectId = new Types.ObjectId(userId);

    const clan = await this.databaseService.repositories.clanModel.findOne({ leader: userObjectId });

    if (!clan) {
      throw new BadRequestException('Clan not found');
    }

    return {
      message: 'Clan found successfully',
      data: clan,
    };
  }


async getClanMembers(clanId: string) {
  // 1️⃣ Clan find karo by ID
  const clan = await this.databaseService.repositories.clanModel.findById(clanId);
  if (!clan) throw new BadRequestException('Clan not found');

  // 2️⃣ Check karo agar members list empty hai
  if (!clan.members || clan.members.length === 0) {
    return {
      message: 'No members found in this clan',
      data: [],
    };
  }

  // 3️⃣ Ab members ke actual user documents lao userModel se
  const members = await this.databaseService.repositories.userModel.find(
    { _id: { $in: clan.members } },   // jitne members ke IDs clan.members me hain
    { name: 1, displayPic: 1, level: 1, _id: 1 }  // ye fields hi chahiye response me
  );

  // 4️⃣ Return final response
  return {
    message: 'Clan members fetched successfully',
    data: members,
  };
}


async removeMember(leaderId: string, clanId: string, userId: string) {
    // 1️⃣ Find the clan
    const clan = await this.databaseService.repositories.clanModel.findById(clanId);
    if (!clan) throw new BadRequestException('Clan not found');

    // 2️⃣ Verify leader
    if (clan.leader.toString() !== leaderId.toString()) {
      throw new BadRequestException('Only the leader can remove a member from this clan');
    }

    // 3️⃣ Check if member exists in members array
    const memberIndex = clan.members.findIndex(
      (m) => m.toString() === userId.toString(),
    );
    if (memberIndex === -1) {
      throw new BadRequestException('Member not found in clan');
    }

    // 4️⃣ Remove member from array
    clan.members.splice(memberIndex, 1);

    // 5️⃣ Decrease current member count
    if (clan.clanCurrentMembers > 0) {
      clan.clanCurrentMembers -= 1;
    }

    // 6️⃣ Save updated clan
    await clan.save();

    // 7️⃣ Delete clan request document (clanId + senderId)
    await this.databaseService.repositories.clanRequestModel.deleteOne({
      clanId: new Types.ObjectId(clanId),
      senderId: new Types.ObjectId(userId),
    });

    // 8️⃣ Return response
    return {
      message: 'Member removed successfully',
      data: {
        removedUserId: userId,
        clanId,
        currentMembers: clan.clanCurrentMembers,
      },
    };
  }

  async removeMemberBySelf(userId: string, clanId: string) {
  // 1️⃣ Clan find karo by clanId
  const clan = await this.databaseService.repositories.clanModel.findById(clanId);
  if (!clan) throw new BadRequestException('Clan not found');

  // 2️⃣ Check karo ke user clan me member hai ya nahi
  const memberIndex = clan.members.findIndex(
    (m) => m.toString() === userId.toString(),
  );
  if (memberIndex === -1) {
    throw new BadRequestException('You are not a member of this clan');
  }

  // 3️⃣ Leader khud ko remove nahi kar sakta (optional check)
  if (clan.leader.toString() === userId.toString()) {
    throw new BadRequestException('Leader cannot leave the clan directly');
  }

  // 4️⃣ Members array se user ko remove karo
  clan.members.splice(memberIndex, 1);

  // 5️⃣ Clan current member count kam karo
  if (clan.clanCurrentMembers > 0) {
    clan.clanCurrentMembers -= 1;
  }

  // 6️⃣ Clan save karo updated data ke sath
  await clan.save();

  // 7️⃣ Clan request document delete karo (clanId + senderId)
  await this.databaseService.repositories.clanRequestModel.deleteOne({
    clanId: new Types.ObjectId(clanId),
    senderId: new Types.ObjectId(userId),
  });

  // 8️⃣ Response return karo
  return {
    message: 'You have successfully left the clan',
    data: {
      leftUserId: userId,
      clanId,
      currentMembers: clan.clanCurrentMembers,
    },
  };
}


 }


