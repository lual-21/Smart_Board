const { getDb } = require("../../lib/mongodb");
const { authenticate } = require("../../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const user = authenticate(req);

        const {
            classroomId
        } = req.body || {};

        if (!classroomId) {
            return res.status(400).json({
                success: false,
                message: "Classroom ID is required"
            });
        }

        const db = await getDb();

        const classroom = await db.collection("classrooms").findOne({
            classroomId
        });

        if (!classroom) {
            return res.status(404).json({
                success: false,
                message: "Classroom not found"
            });
        }

        if (classroom.status === "ENDED") {
            return res.status(403).json({
                success: false,
                message: "This classroom has ended"
            });
        }

        const userId = String(user.id || user._id);

        const isTeacher =
            String(classroom.teacherId) === userId;

        if (
            !isTeacher &&
            classroom.participants.length >=
            classroom.maxParticipants
        ) {
            return res.status(403).json({
                success: false,
                message: "Classroom is full"
            });
        }

        const participant = {
            userId,
            name: user.name || user.fullname || "Student",
            role: isTeacher ? "TEACHER" : "STUDENT",
            joinedAt: new Date(),
            lastSeen: new Date()
        };

        await db.collection("classrooms").updateOne(
            {
                classroomId,
                "participants.userId": {
                    $ne: userId
                }
            },
            {
                $push: {
                    participants: participant
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Joined classroom successfully",
            participant
        });

    } catch (error) {
        console.error("JOIN CLASSROOM ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};