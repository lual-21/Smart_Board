const presence = require("./[id]/presence");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const id = req.body?.classroomId;
  req.query = { ...(req.query || {}), id };
  return presence(req, res);
};
