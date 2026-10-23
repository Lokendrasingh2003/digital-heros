
import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (
      typeof payload === "string" ||
      !payload.sub ||
      !["user", "admin"].includes(payload.role)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
}
