const {
    ObjectId
} = require("mongodb");

const clientPromise =
    require("./mongodb");


function id(value) {

    return ObjectId.isValid(value)
        ? new ObjectId(value)
        : null;

}


async function getClassroom(
    classroomId
) {

    const oid =
        id(classroomId);

    if (!oid)
        return null;

    const db =
        (await clientPromise)
            .db("online_whiteboard");

    return db
        .collection("classrooms")
        .findOne({
            _id:
                oid
        });

}


async function getParticipant(
    classroomId,
    userId
) {

    const db =
        (await clientPromise)
            .db("online_whiteboard");

    return db
        .collection("participants")
        .findOne({
            classroomId,
            userId
        });

}


function canManage(
    user,
    classroom
) {

    return (
        user.role === "ADMIN"
        ||
        classroom.teacherId ===
            user._id.toString()
    );

}


module.exports = {

    id,
    getClassroom,
    getParticipant,
    canManage,
    clientPromise

};