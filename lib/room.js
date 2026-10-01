const { ObjectId } = require("mongodb");
const clientPromise = require("./mongodb");

async function getClassroom(classroomId) {
  const db = (await clientPromise).db("online_whiteboard");
  const value = String(classroomId || "").trim();
  if (!value) return null;

  const query = ObjectId.isValid(value)
    ? { $or: [{ _id: new ObjectId(value) }, { classroomId: value }] }
    : { classroomId: value };

  return db.collection("classrooms").findOne(query);
}

async function getParticipant(classroomId, userId) {
  const db = (await clientPromise).db("online_whiteboard");
  return db.collection("participants").findOne({ classroomId, userId });
}

function canManage(user, classroom) {
  return user.role === "ADMIN" || String(classroom.teacherId) === String(user._id);
}

module.exports = { getClassroom, getParticipant, canManage, clientPromise };
