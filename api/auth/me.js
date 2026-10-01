const { getAuthUser, publicUser, unauthorized } = require("../../lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const user = await getAuthUser(req);
  if (!user) return unauthorized(res);
  return res.status(200).json({ user: publicUser(user) });
};
