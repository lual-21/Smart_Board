const { getAuthUser, publicUser, unauthorized } = require("../../lib/auth");
const { getClassroom, getParticipant, canManage, clientPromise } = require("../../lib/room");

module.exports = async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return unauthorized(res);
  const room = await getClassroom(req.query.id);
  if (!room) return res.status(404).json({ error: "Classroom not found" });
  const db = (await clientPromise).db("online_whiteboard");

  try {
    if (req.method === "GET") {
      const active = await db.collection("participants").find({ classroomId: room.classroomId, lastSeen: { $gt: new Date(Date.now() - 15000) } }).toArray();
      return res.status(200).json({
        classroom: {
          id: room._id.toString(), classroomId: room.classroomId, name: room.name, subject: room.subject,
          description: room.description, teacherId: room.teacherId, teacherName: room.teacherName,
          maxParticipants: room.maxParticipants, status: room.status, settings: room.settings,
          createdAt: room.createdAt, startedAt: room.startedAt, endedAt: room.endedAt, whiteboardSnapshot: room.whiteboardSnapshot || null
        },
        participants: active.map(p => ({ id: p.userId, clientId: p.clientId, fullName: p.fullName, role: p.role, camera: !!p.camera, microphone: !!p.microphone, screen: !!p.screen, lastSeen: p.lastSeen })),
        canManage: canManage(user, room),
        currentUser: publicUser(user)
      });
    }

    if (!canManage(user, room)) return res.status(403).json({ error: "Teacher access required" });

    if (req.method === "PATCH") {
      const body = req.body || {};
      const update = {};
      if (body.action === "start") { update.status = "LIVE"; update.startedAt = new Date(); }
      else if (body.action === "end") { update.status = "ENDED"; update.endedAt = new Date(); }
      else if (body.action === "settings") {
        update.settings = {
          allowStudentDrawing: body.allowStudentDrawing !== false,
          allowStudentMicrophone: body.allowStudentMicrophone !== false,
          allowStudentCamera: body.allowStudentCamera !== false,
          allowStudentScreenSharing: body.allowStudentScreenSharing === true
        };
      } else return res.status(400).json({ error: "Unknown classroom action" });

      await db.collection("classrooms").updateOne({ _id: room._id }, { $set: update });
      await db.collection("roomEvents").insertOne({ classroomId: room.classroomId, type: "room_control", data: update, createdAt: new Date() });
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      await db.collection("classrooms").updateOne({ _id: room._id }, { $set: { status: "ENDED", endedAt: new Date() } });
      await db.collection("roomEvents").insertOne({ classroomId: room.classroomId, type: "room_control", data: { status: "ENDED" }, createdAt: new Date() });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("CLASSROOM_DETAIL_ERROR", error);
    return res.status(500).json({ error: "Server error" });
  }
};
