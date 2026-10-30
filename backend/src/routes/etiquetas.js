const express = require('express');
const crypto = require('crypto');
const { sql, getPool } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/etiquetas
// Ruta PÚBLICA. Devuelve el árbol completo: categorías con sus
// subcategorías anidadas dentro. Lo usan tanto el navegador
// público (para las páginas de categoría) como el panel admin.
// ============================================================
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const resultado = await pool
      .request()
      .query('SELECT Id, Nombre, ParentId FROM dbo.Etiquetas ORDER BY Nombre');

    const todas = resultado.recordset;
    const categorias = todas.filter((e) => !e.ParentId);
    const arbol = categorias.map((cat) => ({
      ...cat,
      subcategorias: todas.filter((e) => e.ParentId === cat.Id),
    }));

    res.json(arbol);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las etiquetas' });
  }
});

// ============================================================
// POST /api/etiquetas
// Ruta PROTEGIDA (solo admin). Crea una categoría (sin parentId)
// o una subcategoría (con parentId).
// ============================================================
router.post('/', requireAdmin, async (req, res) => {
  const { nombre, parentId } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
   const nombreNormalizado = nombre.trim().toLowerCase();

  try {
    const pool = await getPool();

    if (parentId) {
      const padre = await pool
        .request()
        .input('id', sql.UniqueIdentifier, parentId)
        .query('SELECT Id, ParentId FROM dbo.Etiquetas WHERE Id = @id');

      if (padre.recordset.length === 0) {
        return res.status(400).json({ error: 'La categoría padre no existe' });
      }
      if (padre.recordset[0].ParentId) {
        return res.status(400).json({ error: 'No se pueden crear más de 2 niveles' });
      }
    }

    const id = crypto.randomUUID();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('nombre', sql.NVarChar, nombreNormalizado)
      .input('parentId', sql.UniqueIdentifier, parentId || null)
      .query('INSERT INTO dbo.Etiquetas (Id, Nombre, ParentId) VALUES (@id, @nombre, @parentId)');

    res.status(201).json({ id, mensaje: 'Etiqueta creada correctamente' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Ya existe una etiqueta con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la etiqueta' });
  }
});

// ============================================================
// DELETE /api/etiquetas/:id
// Ruta PROTEGIDA (solo admin). Si es una categoría con
// subcategorías, las borra también (en cascada, por el esquema).
// Las entradas que tuvieran esta etiqueta simplemente la pierden
// (la tabla EntradaEtiqueta también tiene ON DELETE CASCADE).
// ============================================================
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const resultado = await pool
      .request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .query('DELETE FROM dbo.Etiquetas WHERE Id = @id');

    if (resultado.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Etiqueta no encontrada' });
    }
    res.json({ mensaje: 'Etiqueta eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la etiqueta' });
  }
});

module.exports = router;