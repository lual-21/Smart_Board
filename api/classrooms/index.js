const { randomBytes } = require("crypto");
const { getAuthUser, unauthorized } = require("../../lib/auth");
const { clientPromise } = require("../../lib/room");

function generateClassroomId() {
  return `SB-${randomBytes(4).toString("hex").toUpperCase()}`;
}

module.exports = async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return unauthorized(res);
  const db = (await clientPromise).db("online_whiteboard");

  try {
    if (req.method === "GET") {
      const filter = user.role === "TEACHER" || user.role === "ADMIN"
        ? (user.role === "ADMIN" ? {} : { teacherId: user._id.toString() })
        : {};
      const classrooms = await db.collection("classrooms").find(filter).sort({ createdAt: -1 }).toArray();
      const now = new Date(Date.now() - 15000);
      const result = [];
      for (const room of classrooms) {
        const participants = await db.collection("participants").countDocuments({ classroomId: room.classroomId, lastSeen: { $gt: now } });
        result.push({
          id: room._id.toString(), classroomId: room.classroomId, name: room.name, subject: room.subject,
          description: room.description || "", status: room.status, participants,
          participantCount: participants, maxParticipants: room.maxParticipants,
          createdAt: room.createdAt, startedAt: room.startedAt, endedAt: room.endedAt
        });
      }
      return res.status(200).json({ classrooms: result });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!["TEACHER", "ADMIN"].includes(user.role)) return res.status(403).json({ error: "Teacher access required" });

    const body = req.body || {};
    const name = String(body.name || "").trim();
    const subject = String(body.subject || "").trim();
    if (!name || !subject) return res.status(400).json({ error: "Classroom name and subject are required" });

    let classroomId;
    do {
      classroomId = generateClassroomId();
    } while (await db.collection("classrooms").findOne({ classroomId }));

    const classroom = {
      classroomId, name, subject, description: String(body.description || "").trim(),
      teacherId: user._id.toString(), teacherName: user.fullName,
      maxParticipants: Math.max(2, Math.min(Number(body.maxParticipants) || 50, 500)),
      settings: {
        allowStudentDrawing: body.allowStudentDrawing !== false,
        allowStudentMicrophone: body.allowStudentMicrophone !== false,
        allowStudentCamera: body.allowStudentCamera !== false,
        allowStudentScreenSharing: body.allowStudentScreenSharing === true
      },
      status: "LIVE", createdAt: new Date(), startedAt: new Date(), endedAt: null,
      whiteboardSnapshot: null
    };
    await db.collection("classrooms").insertOne(classroom);
    return res.status(201).json({
      success: true,
      classroom: {
        classroomId, name, subject, description: classroom.description, status: classroom.status,
        shareLink: `/classroom.html?room=${encodeURIComponent(classroomId)}`
      }
    });
  } catch (error) {
    console.error("CLASSROOM_INDEX_ERROR", error);
    return res.status(500).json({ error: "Server error" });
  }
};
