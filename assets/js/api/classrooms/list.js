const { getDb } = require("../../lib/mongodb");
const { authenticate, requireRole } = require("../../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const user = authenticate(req);

        requireRole(user, ["TEACHER", "ADMIN"]);

        const db = await getDb();

        const teacherId = user.id || user._id;

        const classrooms = await db
            .collection("classrooms")
            .find({
                teacherId
            })
            .sort({
                createdAt: -1
            })
            .toArray();

        const result = classrooms.map(classroom => ({
            classroomId: classroom.classroomId,
            name: classroom.name,
            subject: classroom.subject,
            description: classroom.description,
            status: classroom.status,
            participantCount:
                classroom.participants?.length || 0,
            maxParticipants: classroom.maxParticipants,
            createdAt: classroom.createdAt,
            startedAt: classroom.startedAt,
            endedAt: classroom.endedAt
        }));

        return res.status(200).json({
            success: true,
            classrooms: result
        });

    } catch (error) {
        console.error("LIST CLASSROOMS ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};