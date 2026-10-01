const clientPromise = require("../../lib/mongodb");
const bcrypt = require("bcryptjs");
const { getAuthUser, publicUser, unauthorized } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const actor = await getAuthUser(req);
  const bootstrapOk = process.env.ADMIN_BOOTSTRAP_KEY && req.headers["x-admin-bootstrap-key"] === process.env.ADMIN_BOOTSTRAP_KEY;
  if (!actor && !bootstrapOk) return unauthorized(res);
  if (actor && actor.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });

  try {
    const { fullName, email, password, role = "ADMIN" } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!fullName || !cleanEmail || !password || !["ADMIN", "TEACHER", "STUDENT"].includes(String(role).toUpperCase())) {
      return res.status(400).json({ error: "fullName, email, password and a valid role are required" });
    }
    const db = (await clientPromise).db("online_whiteboard");
    if (await db.collection("users").findOne({ email: cleanEmail })) return res.status(409).json({ error: "User already exists" });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.collection("users").insertOne({
      fullName: String(fullName).trim(), email: cleanEmail, passwordHash,
      role: String(role).toUpperCase(), createdAt: new Date()
    });
    const user = { _id: result.insertedId, fullName: String(fullName).trim(), email: cleanEmail, role: String(role).toUpperCase() };
    return res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    console.error("ADMIN_CREATE_USER_ERROR", error);
    return res.status(500).json({ error: "Server error" });
  }
};
