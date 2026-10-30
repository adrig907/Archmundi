const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../db');

const router = express.Router();

// POST /api/auth/login
// Body esperado: { "email": "...", "password": "..." }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT Id, Email, PasswordHash, Nombre, Activo FROM dbo.Administradores WHERE Email = @email');

    const admin = result.recordset[0];

    // Importante: dar siempre el mismo mensaje de error tanto si el email
    // no existe como si la contraseña es incorrecta. Así no revelamos a un
    // posible atacante si un email concreto existe en el sistema.
    if (!admin || !admin.Activo) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const passwordValida = await bcrypt.compare(password, admin.PasswordHash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: admin.Id, email: admin.Email, nombre: admin.Nombre },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Actualizamos la fecha de último acceso (no crítico, pero útil para auditoría)
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, admin.Id)
      .query('UPDATE dbo.Administradores SET UltimoAcceso = SYSUTCDATETIME() WHERE Id = @id');

    res.json({ token, admin: { id: admin.Id, email: admin.Email, nombre: admin.Nombre } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

module.exports = router;
