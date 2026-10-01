const { getAuthUser, unauthorized } = require("../../../lib/auth");
const { getClassroom, clientPromise } = require("../../../lib/room");

module.exports = async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return unauthorized(res);
  const room = await getClassroom(req.query.id);
  if (!room) return res.status(404).json({ error: "Classroom not found" });
  const db = (await clientPromise).db("online_whiteboard");

  try {
    if (req.method === "GET") {
      const list = await db.collection("participants").find({ classroomId: room.classroomId, lastSeen: { $gt: new Date(Date.now() - 15000) } }).toArray();
      return res.status(200).json({ participants: list.map(p => ({
        id: p.userId, clientId: p.clientId, fullName: p.fullName, role: p.role,
        camera: !!p.camera, microphone: !!p.microphone, screen: !!p.screen
      })) });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (room.status === "ENDED") return res.status(410).json({ error: "This classroom has ended" });

    const body = req.body || {};
    const clientId = String(body.clientId || "");
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(clientId)) return res.status(400).json({ error: "Invalid client id" });

    if (body.offline) {
      await db.collection("participants").deleteOne({ classroomId: room.classroomId, userId: user._id.toString(), clientId });
      return res.status(200).json({ success: true });
    }

    const existing = await db.collection("participants").countDocuments({
      classroomId: room.classroomId, lastSeen: { $gt: new Date(Date.now() - 15000) },
      userId: { $ne: user._id.toString() }
    });
    const already = await db.collection("participants").findOne({ classroomId: room.classroomId, userId: user._id.toString() });
    if (!already && existing >= room.maxParticipants) return res.status(409).json({ error: "This classroom is full" });

    await db.collection("participants").updateOne(
      { classroomId: room.classroomId, userId: user._id.toString() },
      { $set: {
        classroomId: room.classroomId, userId: user._id.toString(), clientId,
        fullName: user.fullName, role: user.role, camera: !!body.camera,
        microphone: !!body.microphone, screen: !!body.screen, lastSeen: new Date()
      } },
      { upsert: true }
    );

    if (!already) {
      await db.collection("roomEvents").insertOne({
        classroomId: room.classroomId, type: "media", data: { action: "joined", clientId, fullName: user.fullName, role: user.role },
        from: { userId: user._id.toString(), fullName: user.fullName, role: user.role },
        createdAt: new Date(), createdAtMs: Date.now()
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("PRESENCE_ERROR", error);
    return res.status(500).json({ error: "Server error" });
  }
};
