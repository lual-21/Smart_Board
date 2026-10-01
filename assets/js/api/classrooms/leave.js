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

        const { classroomId } = req.body || {};

        if (!classroomId) {
            return res.status(400).json({
                success: false,
                message: "Classroom ID is required"
            });
        }

        const db = await getDb();

        const userId = String(user.id || user._id);

        await db.collection("classrooms").updateOne(
            {
                classroomId
            },
            {
                $pull: {
                    participants: {
                        userId
                    }
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: "Left classroom"
        });

    } catch (error) {
        console.error("LEAVE CLASSROOM ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};