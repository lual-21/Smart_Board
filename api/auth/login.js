const clientPromise = require("../../lib/mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { setAuthCookie, publicUser } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: "JWT_SECRET is not configured" });

    const client = await clientPromise;
    const db = client.db("online_whiteboard");
    const user = await db.collection("users").findOne({ email: email.trim().toLowerCase() });

    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Safely migrate old records that have no role.
    if (!user.role) {
      user.role = "STUDENT";
      await db.collection("users").updateOne({ _id: user._id }, { $set: { role: "STUDENT" } });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    setAuthCookie(res, token);
    return res.status(200).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("LOGIN_ERROR", error);
    return res.status(500).json({ error: "Server error" });
  }
};
