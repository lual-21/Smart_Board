const clientPromise = require("../../lib/mongodb");
const bcrypt = require("bcryptjs");
const { publicUser } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fullName, email, password, role } = req.body || {};
    const cleanName = String(fullName || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const requestedRole = String(role || "STUDENT").toUpperCase();

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ error: "Full name, email and password are required" });
    }
    if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: "Enter a valid email address" });
    if (!["TEACHER", "STUDENT"].includes(requestedRole)) {
      return res.status(403).json({ error: "Admin accounts must be created by an administrator" });
    }

    const client = await clientPromise;
    const db = client.db("online_whiteboard");
    const users = db.collection("users");
    if (await users.findOne({ email: cleanEmail })) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await users.insertOne({
      fullName: cleanName,
      email: cleanEmail,
      passwordHash,
      role: requestedRole,
      createdAt: new Date()
    });

    const user = { _id: result.insertedId, fullName: cleanName, email: cleanEmail, role: requestedRole };
    return res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("SIGNUP_ERROR", error);
    return res.status(500).json({ error: "Server error" });
  }
};
