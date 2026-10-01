const { getDb } = require("../../lib/mongodb");
const { authenticate, requireRole } = require("../../lib/auth");

module.exports = async function handler(req, res) {
    if (req.method !== "PATCH" && req.method !== "PUT") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const user = authenticate(req);

        requireRole(user, ["TEACHER", "ADMIN"]);

        const {
            classroomId,
            name,
            subject,
            description,
            maxParticipants,
            settings
        } = req.body || {};

        if (!classroomId) {
            return res.status(400).json({
                success: false,
                message: "Classroom ID is required"
            });
        }

        const db = await getDb();

        const teacherId = String(user.id || user._id);

        const classroom =
            await db.collection("classrooms").findOne({
                classroomId
            });

        if (!classroom) {
            return res.status(404).json({
                success: false,
                message: "Classroom not found"
            });
        }

        if (
            String(classroom.teacherId) !== teacherId &&
            user.role !== "ADMIN"
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the teacher can modify this classroom"
            });
        }

        const update = {};

        if (name !== undefined) {
            update.name = String(name).trim();
        }

        if (subject !== undefined) {
            update.subject = String(subject).trim();
        }

        if (description !== undefined) {
            update.description = String(description).trim();
        }

        if (maxParticipants !== undefined) {
            update.maxParticipants = Math.max(
                1,
                Math.min(Number(maxParticipants), 500)
            );
        }

        if (settings) {
            update.settings = {
                ...classroom.settings,
                ...settings
            };
        }

        await db.collection("classrooms").updateOne(
            {
                classroomId
            },
            {
                $set: update
            }
        );

        return res.status(200).json({
            success: true,
            message: "Classroom updated"
        });

    } catch (error) {
        console.error("UPDATE CLASSROOM ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};