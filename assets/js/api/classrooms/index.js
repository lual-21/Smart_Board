const crypto = require("crypto");

const {
    getAuthUser,
    publicUser,
    unauthorized
} = require("../../lib/auth");

const {
    clientPromise
} = require("../../lib/room");


function classroomId() {

    return "SB-" +
        crypto
            .randomBytes(4)
            .toString("hex")
            .toUpperCase();

}


module.exports = async (req, res) => {

    const user =
        await getAuthUser(req);

    if (!user)
        return unauthorized(res);

    const db =
        (await clientPromise)
            .db("online_whiteboard");

    try {

        /*
         * GET CLASSROOMS
         */

        if (
            req.method === "GET"
        ) {

            const query =
                user.role === "TEACHER"
                    ? {
                        teacherId:
                            user._id.toString()
                    }

                    : user.role === "ADMIN"
                        ? {}

                        : {
                            status: {
                                $ne: "ENDED"
                            }
                        };

            const rooms =
                await db
                    .collection("classrooms")
                    .find(query)
                    .sort({
                        createdAt: -1
                    })
                    .limit(100)
                    .toArray();


            const active =
                await db
                    .collection("participants")
                    .aggregate([
                        {
                            $match: {
                                lastSeen: {
                                    $gt:
                                        new Date(
                                            Date.now()
                                            -
                                            15000
                                        )
                                }
                            }
                        },

                        {
                            $group: {
                                _id:
                                    "$classroomId",

                                count: {
                                    $sum: 1
                                }
                            }
                        }
                    ])
                    .toArray();


            const counts =
                Object.fromEntries(
                    active.map(
                        x => [
                            x._id,
                            x.count
                        ]
                    )
                );


            return res
                .status(200)
                .json({

                    classrooms:
                        rooms.map(
                            r => ({

                                id:
                                    r._id
                                        .toString(),

                                classroomId:
                                    r.classroomId,

                                name:
                                    r.name,

                                subject:
                                    r.subject,

                                description:
                                    r.description,

                                status:
                                    r.status,

                                maxParticipants:
                                    r.maxParticipants,

                                allowStudentDrawing:
                                    r.settings
                                        ?.allowStudentDrawing
                                        !== false,

                                allowStudentMicrophone:
                                    r.settings
                                        ?.allowStudentMicrophone
                                        !== false,

                                allowStudentCamera:
                                    r.settings
                                        ?.allowStudentCamera
                                        !== false,

                                allowStudentScreenSharing:
                                    r.settings
                                        ?.allowStudentScreenSharing
                                        === true,

                                teacherId:
                                    r.teacherId,

                                createdAt:
                                    r.createdAt,

                                startedAt:
                                    r.startedAt,

                                endedAt:
                                    r.endedAt,

                                participants:
                                    counts[
                                        r.classroomId
                                    ] || 0

                            })
                        )

                });

        }


        /*
         * CREATE CLASSROOM
         */

        if (
            req.method !== "POST"
        )
            return res
                .status(405)
                .json({
                    error:
                        "Method not allowed"
                });


        if (
            ![
                "TEACHER",
                "ADMIN"
            ].includes(
                user.role
            )
        ) {

            return res
                .status(403)
                .json({
                    error:
                        "Only teachers can create classrooms"
                });

        }


        const body =
            req.body || {};


        const name =
            String(
                body.name || ""
            ).trim();


        const subject =
            String(
                body.subject || ""
            ).trim();


        const maxParticipants =
            Math.min(
                500,
                Math.max(
                    2,
                    Number(
                        body.maxParticipants ||
                        50
                    )
                )
            );


        if (
            !name ||
            !subject
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Classroom name and subject are required"
                });

        }


        let code =
            classroomId();


        while (
            await db
                .collection("classrooms")
                .findOne({
                    classroomId:
                        code
                })
        ) {

            code =
                classroomId();

        }


        const doc = {

            classroomId:
                code,

            name,

            subject,

            description:
                String(
                    body.description || ""
                ).trim(),

            teacherId:
                user._id.toString(),

            teacherName:
                user.fullName,

            maxParticipants,

            status:
                "SCHEDULED",

            settings: {

                allowStudentDrawing:
                    body.allowStudentDrawing !== false,

                allowStudentMicrophone:
                    body.allowStudentMicrophone !== false,

                allowStudentCamera:
                    body.allowStudentCamera !== false,

                allowStudentScreenSharing:
                    body.allowStudentScreenSharing === true

            },

            createdAt:
                new Date(),

            startedAt:
                null,

            endedAt:
                null

        };


        const result =
            await db
                .collection("classrooms")
                .insertOne(
                    doc
                );


        return res
            .status(201)
            .json({

                success:
                    true,

                classroom: {

                    ...doc,

                    id:
                        result.insertedId
                            .toString()

                }

            });


    } catch (error) {

        console.error(
            "CLASSROOMS_ERROR",
            error
        );

        return res
            .status(500)
            .json({
                error:
                    "Server error"
            });

    }

};