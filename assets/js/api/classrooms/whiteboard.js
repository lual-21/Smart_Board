const { getDb } = require("../../lib/mongodb");
const { authenticate } = require("../../lib/auth");

module.exports = async function handler(req, res) {
    try {
        const user = authenticate(req);

        const db = await getDb();

        if (req.method === "GET") {

            const classroomId =
                req.query.classroomId;

            if (!classroomId) {
                return res.status(400).json({
                    success: false,
                    message: "Classroom ID is required"
                });
            }

            const board =
                await db.collection("whiteboards")
                    .findOne({
                        classroomId
                    });

            return res.status(200).json({
                success: true,
                board: board?.data || null
            });
        }

        if (req.method === "PUT") {

            const {
                classroomId,
                data
            } = req.body || {};

            if (!classroomId) {
                return res.status(400).json({
                    success: false,
                    message: "Classroom ID is required"
                });
            }

            await db.collection("whiteboards").updateOne(
                {
                    classroomId
                },
                {
                    $set: {
                        classroomId,
                        data,
                        updatedBy:
                            user.id ||
                            user._id,
                        updatedAt: new Date()
                    }
                },
                {
                    upsert: true
                }
            );

            return res.status(200).json({
                success: true,
                message: "Whiteboard saved"
            });
        }

        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });

    } catch (error) {
        console.error("WHITEBOARD ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};