const {
    getAuthUser,
    unauthorized
} = require("../../../lib/auth");

const {
    getClassroom,
    getParticipant,
    clientPromise
} = require("../../../lib/room");


const ALLOWED =
    new Set([
        "chat",
        "stroke",
        "clear",
        "undo",
        "redo",
        "signal",
        "media",
        "room_control",
        "pointer",
        "snapshot"
    ]);


module.exports = async (
    req,
    res
) => {

    const user =
        await getAuthUser(req);

    if (!user)
        return unauthorized(res);


    const room =
        await getClassroom(
            req.query.id
        );


    if (!room)
        return res
            .status(404)
            .json({
                error:
                    "Classroom not found"
            });


    const db =
        (await clientPromise)
            .db("online_whiteboard");


    try {

        /*
         * GET EVENTS
         */

        if (
            req.method === "GET"
        ) {

            const since =
                Number(
                    req.query.since ||
                    0
                );


            const docs =
                await db
                    .collection("roomEvents")
                    .find({

                        classroomId:
                            room.classroomId,

                        createdAtMs: {
                            $gt:
                                since
                        }

                    })
                    .sort({
                        createdAtMs:
                            1
                    })
                    .limit(300)
                    .toArray();


            return res
                .status(200)
                .json({

                    events:
                        docs.map(
                            e => ({

                                id:
                                    e._id
                                        .toString(),

                                type:
                                    e.type,

                                data:
                                    e.data,

                                from:
                                    e.from,

                                createdAtMs:
                                    e.createdAtMs

                            })
                        )

                });

        }


        if (
            req.method !== "POST"
        ) {

            return res
                .status(405)
                .json({
                    error:
                        "Method not allowed"
                });

        }


        const participant =
            await getParticipant(
                room.classroomId,
                user._id.toString()
            );


        const isTeacher =
            room.teacherId ===
                user._id.toString()
            ||
            user.role ===
                "ADMIN";


        if (
            !participant &&
            !isTeacher
        ) {

            return res
                .status(403)
                .json({
                    error:
                        "Join the classroom first"
                });

        }


        const {
            type,
            data
        } = req.body || {};


        if (
            !ALLOWED.has(type)
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Unsupported event"
                });

        }


        /*
         * STUDENT DRAWING CONTROL
         */

        if (
            type === "stroke" &&
            user.role === "STUDENT" &&
            room.settings
                ?.allowStudentDrawing === false
        ) {

            return res
                .status(403)
                .json({
                    error:
                        "Student drawing is disabled"
                });

        }


        /*
         * WEBRTC SIGNAL VALIDATION
         */

        if (
            type === "signal"
        ) {

            if (!data?.to) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Signal recipient is required"
                    });

            }


            const target =
                await db
                    .collection("participants")
                    .findOne({

                        classroomId:
                            room.classroomId,

                        clientId:
                            data.to

                    });


            if (!target) {

                return res
                    .status(404)
                    .json({
                        error:
                            "Participant not found"
                    });

            }

        }


        const now =
            Date.now();


        const doc = {

            classroomId:
                room.classroomId,

            type,

            data:
                data || {},

            from: {

                userId:
                    user._id.toString(),

                fullName:
                    user.fullName,

                role:
                    user.role

            },

            createdAt:
                new Date(now),

            createdAtMs:
                now

        };


        const result =
            await db
                .collection("roomEvents")
                .insertOne(
                    doc
                );


        /*
         * STORE CURRENT WHITEBOARD
         */

        if (
            type === "snapshot" &&
            data?.image
        ) {

            await db
                .collection("classrooms")
                .updateOne(

                    {
                        _id:
                            room._id
                    },

                    {
                        $set: {

                            whiteboardSnapshot:
                                String(
                                    data.image
                                ).slice(
                                    0,
                                    5000000
                                )

                        }
                    }

                );

        }


        /*
         * PERIODIC CLEANUP
         */

        if (
            Math.random() < 0.02
        ) {

            await db
                .collection("roomEvents")
                .deleteMany({

                    classroomId:
                        room.classroomId,

                    createdAtMs: {
                        $lt:
                            now -
                            6 *
                            60 *
                            60 *
                            1000
                    }

                });

        }


        return res
            .status(201)
            .json({

                success:
                    true,

                id:
                    result.insertedId
                        .toString(),

                createdAtMs:
                    now

            });


    } catch (error) {

        console.error(
            "ROOM_EVENT_ERROR",
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