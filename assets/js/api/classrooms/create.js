const { randomBytes } = require("crypto");
const { getDb } = require("../../lib/mongodb");
const { authenticate, requireRole } = require("../../lib/auth");

function generateClassroomId() {
    return randomBytes(4)
        .toString("hex")
        .toUpperCase();
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const user = authenticate(req);

        requireRole(user, ["TEACHER", "ADMIN"]);

        const {
            name,
            subject,
            description = "",
            maxParticipants = 50,
            allowStudentDrawing = true,
            allowStudentMicrophone = true,
            allowStudentCamera = true,
            allowStudentScreenSharing = false
        } = req.body || {};

        if (!name || !subject) {
            return res.status(400).json({
                success: false,
                message: "Classroom name and subject are required"
            });
        }

        const db = await getDb();

        let classroomId;
        let exists = true;

        while (exists) {
            classroomId = generateClassroomId();

            const existing = await db.collection("classrooms").findOne({
                classroomId
            });

            exists = !!existing;
        }

        const classroom = {
            classroomId,
            name: String(name).trim(),
            subject: String(subject).trim(),
            description: String(description).trim(),

            teacherId: user.id || user._id,
            teacherName: user.name || user.fullname || "Teacher",

            maxParticipants: Math.max(
                1,
                Math.min(Number(maxParticipants) || 50, 500)
            ),

            settings: {
                allowStudentDrawing: Boolean(allowStudentDrawing),
                allowStudentMicrophone: Boolean(allowStudentMicrophone),
                allowStudentCamera: Boolean(allowStudentCamera),
                allowStudentScreenSharing: Boolean(
                    allowStudentScreenSharing
                )
            },

            status: "LIVE",

            participants: [],

            createdAt: new Date(),
            startedAt: new Date(),
            endedAt: null
        };

        await db.collection("classrooms").insertOne(classroom);

        return res.status(201).json({
            success: true,
            classroom: {
                classroomId: classroom.classroomId,
                name: classroom.name,
                subject: classroom.subject,
                description: classroom.description,
                status: classroom.status,
                shareLink:
                    `/classroom.html?classroom=${classroom.classroomId}`
            }
        });

    } catch (error) {
        console.error("CREATE CLASSROOM ERROR:", error);

        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};