const { getAuthUser, publicUser, unauthorized } = require("../../lib/auth");
const { getClassroom, clientPromise, canManage } = require("../../lib/room");
module.exports = async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return unauthorized(res);
  const id = req.query.classroomId || req.query.id;
  const room = await getClassroom(id);
  if (!room) return res.status(404).json({ error: "Classroom not found" });
  const db = (await clientPromise).db("online_whiteboard");
  const count = await db.collection("participants").countDocuments({ classroomId: room.classroomId, lastSeen: { $gt: new Date(Date.now()-15000) } });
  return res.status(200).json({ classroom: { ...room, id: room._id.toString(), participantCount: count, participants: undefined }, currentUser: publicUser(user), canManage: canManage(user, room) });
};
