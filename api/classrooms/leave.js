const presence = require("./[id]/presence");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  req.query = { ...(req.query || {}), id: req.body?.classroomId };
  req.body = { ...(req.body || {}), offline: true, clientId: req.body?.clientId || "placeholder" };
  return presence(req, res);
};
