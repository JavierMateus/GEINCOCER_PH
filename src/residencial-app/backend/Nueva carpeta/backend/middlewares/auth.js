// backend/middlewares/auth.js

exports.verifyAdmin = (req, res, next) => {
  // Temporal: siempre permite acceso
  next();
};
