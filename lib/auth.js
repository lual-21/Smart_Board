const jwt = require("jsonwebtoken");

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization || "";

    if (authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }

    // Allows the frontend to use an httpOnly cookie if you add one later.
    if (req.headers.cookie) {
        const cookies = Object.fromEntries(
            req.headers.cookie.split(";").map(cookie => {
                const [key, ...value] = cookie.trim().split("=");
                return [key, decodeURIComponent(value.join("="))];
            })
        );

        if (cookies.token) {
            return cookies.token;
        }
    }

    return null;
}

function authenticate(req) {
    const token = getTokenFromRequest(req);

    if (!token) {
        throw new Error("Authentication required");
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }

    try {
        return jwt.verify(token, secret);
    } catch (error) {
        throw new Error("Invalid or expired token");
    }
}

function requireRole(user, roles) {
    if (!roles.includes(user.role)) {
        throw new Error("You do not have permission to perform this action");
    }
}

module.exports = {
    authenticate,
    requireRole
};