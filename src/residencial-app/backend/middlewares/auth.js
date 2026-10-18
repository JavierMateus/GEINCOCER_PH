// backend/middlewares/auth.js

// Solo deja pasar a un administrador con sesión iniciada.
// Necesita que antes se haya ejecutado requiereSesion (middlewares/sesion.js), que llena req.sesion.
exports.verifyAdmin = (req, res, next) => {
  if (req.sesion && req.sesion.rol === "Administrador") return next();
  return res.status(403).json({ error: "Solo un administrador puede hacer esto." });
};