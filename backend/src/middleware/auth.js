const jwt = require('jsonwebtoken');

// Middleware que protege las rutas de escritura.
// Se coloca delante de cualquier ruta que solo el admin pueda usar.
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization; // formato esperado: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta el token de autenticación' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload; // { id, email } disponible en el resto de la petición
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o caducado' });
  }
}

module.exports = { requireAdmin };
