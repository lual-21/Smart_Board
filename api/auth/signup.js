const clientPromise = require("../../lib/mongodb");
const bcrypt = require("bcryptjs");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({
                error: "All fields are required"
            });
        }

        const client = await clientPromise;
        const db = client.db("online_whiteboard");

        const users = db.collection("users");

        const existingUser = await users.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                error: "User already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await users.insertOne({
            fullName,
            email: email.toLowerCase(),
            passwordHash,
            createdAt: new Date()
        });

        return res.status(201).json({
            success: true,
            userId: result.insertedId
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Server error"
        });
    }
};