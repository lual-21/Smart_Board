const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const clientPromise = require("./mongodb");

const COOKIE_NAME = "smartboard_token";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function getTokenFromRequest(req) {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  return parseCookies(req)[COOKIE_NAME] || null;
}

function verifyToken(req) {
  const token = getTokenFromRequest(req);
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch (_) {
    return null;
  }
}

async function getAuthUser(req) {
  const payload = verifyToken(req);
  if (!payload?.userId || !ObjectId.isValid(payload.userId)) return null;

  const client = await clientPromise;
  const db = client.db("online_whiteboard");
  const user = await db.collection("users").findOne({ _id: new ObjectId(payload.userId) });
  if (!user) return null;

  if (!user.role) {
    user.role = "STUDENT";
    await db.collection("users").updateOne({ _id: user._id }, { $set: { role: "STUDENT" } });
  }
  return user;
}

function authenticate(req) {
  const payload = verifyToken(req);
  if (!payload) throw new Error("Authentication required");
  return payload;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw new Error("You do not have permission to perform this action");
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id?.toString?.() || user.id || user.userId,
    fullName: user.fullName || user.name || "User",
    email: user.email || "",
    role: user.role || "STUDENT"
  };
}

function unauthorized(res) {
  return res.status(401).json({ error: "Authentication required" });
}

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800"
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAuthCookie(res) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

module.exports = {
  getTokenFromRequest,
  authenticate,
  getAuthUser,
  requireRole,
  publicUser,
  unauthorized,
  setAuthCookie,
  clearAuthCookie
};
