/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { DatabaseService } from '../database/databaseservice';
import { FirebaseAdminService } from '../firebaseAdmin/firebase-admin.service';

export const FRIEND_PAGE_MAX = 50;

// Purane friend records me ids text (string) ki shakal me save hain, naye ObjectId bhi ho sakte hain —
// is liye har query dono shaklon se match karti hai.
const idForms = (id: unknown) => {
  const s = String(id);
  return isValidObjectId(s) ? [s, new Types.ObjectId(s)] : [s];
};
const idQ = (id: unknown) => ({ $in: idForms(id) });
const idsQ = (ids: unknown[]) => ({ $in: ids.flatMap(idForms) });
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// players jo friends list / search me dikh sakte hain
const VISIBLE_PLAYER = { role: { $ne: 'admin' }, isDeleted: { $ne: true }, isBanned: { $ne: true } };

// relationStatus (game ka enum): open = koi rishta nahi, requested = maine bheji, pending = mujhe aayi, close = friends
@Injectable()
export class FriendService {
  private readonly logger = new Logger('Friends');

  constructor(
    private databaseService: DatabaseService,
    private firebase: FirebaseAdminService,
  ) {}

  private get users() {
    return this.databaseService.repositories.userModel;
  }

  private get friends() {
    return this.databaseService.repositories.friendModel;
  }

  private page(page: number, limit: number) {
    const p = Math.max(1, Math.floor(page) || 1);
    const l = Math.min(FRIEND_PAGE_MAX, Math.max(1, Math.floor(limit) || 10));
    return { page: p, limit: l, skip: (p - 1) * l };
  }

  private pagination(total: number, page: number, limit: number) {
    return { total, page, limit, totalPages: Math.ceil(total / limit), hasMore: page * limit < total };
  }

  private card(user: any, relationStatus: string) {
    return { _id: user._id, name: user.name, displayPic: user.displayPic, level: user.level, relationStatus };
  }

  // 🔔 push to one player; never fails the request (no token / app removed = just skip)
  private async push(userId: unknown, title: string, body: string, data: Record<string, string>) {
    try {
      const user = await this.users.findById(String(userId)).select('fcmToken isBanned isDeleted').lean();
      if (!user?.fcmToken || user.isBanned || user.isDeleted) return;
      const result = await this.firebase.sendToMany([user.fcmToken], { title, body }, data);
      if (result.invalidTokens.length) {
        await this.users.updateOne({ _id: user._id, fcmToken: user.fcmToken }, { $set: { fcmToken: null } });
      }
    } catch (error) {
      this.logger.warn(`Push to ${userId} failed: ${error.message}`);
    }
  }

  // the one active (not removed) record between two players, either direction
  private activeBetween(a: string, b: string) {
    return this.friends.findOne({
      isDeleted: false,
      status: { $in: ['pending', 'open'] },
      $or: [
        { senderId: idQ(a), receiverId: idQ(b) },
        { senderId: idQ(b), receiverId: idQ(a) },
      ],
    });
  }

  async sendFriendRequest(senderId: string, receiverId: string) {
    if (String(senderId) === String(receiverId)) throw new BadRequestException("You can't add yourself");

    const [sender, receiver] = await Promise.all([
      this.users.findById(senderId).select('name').lean(),
      this.users.findOne({ _id: receiverId, ...VISIBLE_PLAYER }).select('name').lean(),
    ]);
    if (!sender) throw new NotFoundException('Player not found');
    if (!receiver) throw new NotFoundException('Player not found');

    const active = await this.activeBetween(senderId, receiverId);
    if (active?.status === 'open') throw new BadRequestException(`You are already friends with ${receiver.name}`);
    if (active && String(active.senderId) === String(senderId)) {
      throw new BadRequestException('You have already sent a friend request');
    }
    if (active) {
      // they already asked me → sending back = accepting
      const accepted = await this.friends.findOneAndUpdate(
        { _id: active._id, status: 'pending', isDeleted: false },
        { $set: { status: 'open' } },
        { new: true },
      );
      if (accepted) {
        void this.push(receiverId, 'Friend request accepted', `${sender.name} accepted your friend request`, {
          type: 'friend_accepted', userId: String(senderId),
        });
        return { message: `You are now friends with ${receiver.name}`, data: accepted };
      }
    }

    // reuse an old declined / cancelled / removed record so there is only one per pair
    const fields = {
      senderId: String(senderId),
      receiverId: String(receiverId),
      senderName: sender.name,
      receiverName: receiver.name,
      status: 'pending',
      isDeleted: false,
    };
    const old = await this.friends.findOne({
      $or: [
        { senderId: idQ(senderId), receiverId: idQ(receiverId) },
        { senderId: idQ(receiverId), receiverId: idQ(senderId) },
      ],
    }).sort({ updatedAt: -1 });

    let request;
    if (old) {
      // only if it is still inactive (another request could have landed in between)
      request = await this.friends.findOneAndUpdate(
        { _id: old._id, $or: [{ isDeleted: true }, { status: 'close' }] },
        { $set: fields },
        { new: true },
      );
      if (!request) throw new BadRequestException('You have already sent a friend request');
    } else {
      request = await this.friends.create(fields);
    }

    void this.push(receiverId, 'New friend request', `${sender.name} wants to be your friend`, {
      type: 'friend_request', userId: String(senderId),
    });
    return { message: 'Friend request sent', data: request };
  }

  // type: get-friend-request (sent to me) | my-sending-request (sent by me)
  async getFriendRequests(userId: string, type: string, page: number, limit: number) {
    const incoming = type === 'get-friend-request';
    if (!incoming && type !== 'my-sending-request') throw new BadRequestException('Invalid type');
    const p = this.page(page, limit);

    const filter = incoming
      ? { receiverId: idQ(userId), status: 'pending', isDeleted: false }
      : { senderId: idQ(userId), status: 'pending', isDeleted: false };
    const otherField = incoming ? 'senderId' : 'receiverId';

    const [requests, total] = await Promise.all([
      this.friends.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(p.skip).limit(p.limit).lean(),
      this.friends.countDocuments(filter),
    ]);
    const otherIds = requests.map((r) => String(r[otherField]));
    const users = await this.users.find({ _id: { $in: otherIds } }).select('_id name displayPic level').lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    return {
      message: 'Friend requests fetched successfully',
      data: otherIds.filter((id) => byId.has(id)).map((id) => this.card(byId.get(id), incoming ? 'pending' : 'requested')),
      pagination: this.pagination(total, p.page, p.limit),
    };
  }

  // receiver answers: accept → friends (push to the sender), reject/decline → request closed
  async acceptRequest(receiverId: string, body: { id: string; type?: string }) {
    const accept = body.type === 'accept';
    if (!accept && body.type !== 'reject' && body.type !== 'decline') {
      throw new BadRequestException('Invalid type');
    }

    const request = await this.friends.findOneAndUpdate(
      { senderId: idQ(body.id), receiverId: idQ(receiverId), status: 'pending', isDeleted: false },
      { $set: accept ? { status: 'open' } : { status: 'close', isDeleted: true } },
      { new: true },
    );
    if (!request) throw new BadRequestException('Request not found or already answered');

    if (accept) {
      const me = await this.users.findById(receiverId).select('name').lean();
      void this.push(body.id, 'Friend request accepted', `${me?.name || 'A player'} accepted your friend request`, {
        type: 'friend_accepted', userId: String(receiverId),
      });
    }
    return { message: accept ? 'Friend request accepted' : 'Friend request declined', data: request };
  }

  // sender cancels a request they sent
  async declineFriendRequest(senderId: string, receiverId: string) {
    const request = await this.friends.findOneAndUpdate(
      { senderId: idQ(senderId), receiverId: idQ(receiverId), status: 'pending', isDeleted: false },
      { $set: { status: 'close', isDeleted: true } },
      { new: true },
    );
    if (!request) throw new NotFoundException('Friend request not found');
    return { message: 'Friend request cancelled' };
  }

  async getFriends(userId: string, page: number, limit: number, search?: string) {
    const p = this.page(page, limit);
    const filter: any = {
      status: 'open',
      isDeleted: false,
      $or: [{ senderId: idQ(userId) }, { receiverId: idQ(userId) }],
    };

    if (search?.trim()) {
      const matching = await this.users
        .find({ name: { $regex: escapeRegex(search.trim()), $options: 'i' } })
        .select('_id').limit(1000).lean();
      const ids = matching.map((u) => u._id);
      filter.$or = [
        { senderId: idQ(userId), receiverId: idsQ(ids) },
        { receiverId: idQ(userId), senderId: idsQ(ids) },
      ];
    }

    const [links, total] = await Promise.all([
      this.friends.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(p.skip).limit(p.limit).lean(),
      this.friends.countDocuments(filter),
    ]);
    const otherIds = links.map((l) => String(String(l.senderId) === String(userId) ? l.receiverId : l.senderId));
    const users = await this.users.find({ _id: { $in: otherIds } }).select('_id name displayPic level').lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    return {
      message: 'Friends fetched successfully',
      data: otherIds.filter((id) => byId.has(id)).map((id) => this.card(byId.get(id), 'close')),
      pagination: this.pagination(total, p.page, p.limit),
    };
  }

  // All Players tab: everyone except me (and admins / banned / removed), with my relation to each
  async getAllUsers(currentUserId: string, page: number, limit: number, search?: string) {
    const p = this.page(page, limit);
    const query: any = { ...VISIBLE_PLAYER, _id: { $ne: new Types.ObjectId(String(currentUserId)) } };
    if (search?.trim()) query.name = { $regex: escapeRegex(search.trim()), $options: 'i' };

    const [users, total] = await Promise.all([
      this.users.find(query).select('_id name displayPic level').sort({ level: -1, _id: 1 }).skip(p.skip).limit(p.limit).lean(),
      this.users.countDocuments(query),
    ]);

    const userIds = users.map((u) => String(u._id));
    const relations = userIds.length
      ? await this.friends.find({
          isDeleted: false,
          status: { $in: ['pending', 'open'] },
          $or: [
            { senderId: idQ(currentUserId), receiverId: idsQ(userIds) },
            { receiverId: idQ(currentUserId), senderId: idsQ(userIds) },
          ],
        }).lean()
      : [];

    const me = String(currentUserId);
    const data = users.map((user) => {
      const id = String(user._id);
      const relation = relations.find(
        (r) => (String(r.senderId) === me && String(r.receiverId) === id) || (String(r.receiverId) === me && String(r.senderId) === id),
      );
      let relationStatus = 'open';
      if (relation?.status === 'open') relationStatus = 'close';
      else if (relation?.status === 'pending') relationStatus = String(relation.senderId) === me ? 'requested' : 'pending';
      return this.card(user, relationStatus);
    });

    return { message: 'Users fetched successfully', data, pagination: this.pagination(total, p.page, p.limit) };
  }

  async removeFriend(currentUserId: string, otherUserId: string) {
    const friend = await this.friends.findOneAndUpdate(
      {
        $or: [
          { senderId: idQ(currentUserId), receiverId: idQ(otherUserId) },
          { senderId: idQ(otherUserId), receiverId: idQ(currentUserId) },
        ],
        status: 'open',
        isDeleted: false,
      },
      { $set: { isDeleted: true } },
      { new: true },
    );
    if (!friend) throw new NotFoundException('Friendship not found or already removed');
    return { message: 'Friend removed' };
  }
}
