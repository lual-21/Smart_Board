const { getDb } = require("../../lib/mongodb");
const { authenticate } = require("../../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const user = authenticate(req);

        const classroomId =
            req.query.classroomId ||
            req.query.id;

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

        const userId = user.id || user._id;

        const isTeacher =
            String(classroom.teacherId) === String(userId);

        return res.status(200).json({
            success: true,

            classroom: {
                classroomId: classroom.classroomId,
                name: classroom.name,
                subject: classroom.subject,
                description: classroom.description,

                teacherName: classroom.teacherName,

                status: classroom.status,

                maxParticipants:
                    classroom.maxParticipants,

                participantCount:
                    classroom.participants?.length || 0,

                settings:
                    classroom.settings,

                isTeacher,

                createdAt: classroom.createdAt,
                startedAt: classroom.startedAt,
                endedAt: classroom.endedAt
            }
        });

    } catch (error) {
        console.error("GET CLASSROOM ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};