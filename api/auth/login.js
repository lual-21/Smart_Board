const clientPromise = require("../../lib/mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const client = await clientPromise;
        const db = client.db("online_whiteboard");

        const user = await db.collection("users").findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!validPassword) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Server error"
        });
    }
};