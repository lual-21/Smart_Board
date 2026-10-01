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

            const messages =
                await db.collection("classroom_messages")
                    .find({
                        classroomId
                    })
                    .sort({
                        createdAt: 1
                    })
                    .limit(300)
                    .toArray();

            return res.status(200).json({
                success: true,
                messages
            });
        }

        if (req.method === "POST") {

            const {
                classroomId,
                message
            } = req.body || {};

            if (!classroomId || !message) {
                return res.status(400).json({
                    success: false,
                    message: "Classroom ID and message are required"
                });
            }

            const chatMessage = {
                classroomId,

                userId:
                    user.id ||
                    user._id,

                userName:
                    user.name ||
                    user.fullname ||
                    "User",

                role:
                    user.role ||
                    "STUDENT",

                message:
                    String(message)
                        .trim()
                        .substring(0, 2000),

                createdAt: new Date()
            };

            await db
                .collection("classroom_messages")
                .insertOne(chatMessage);

            return res.status(201).json({
                success: true,
                message: chatMessage
            });
        }

        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });

    } catch (error) {
        console.error("CHAT ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};