require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const entradasRoutes = require('./routes/entradas');
const etiquetasRoutes = require('./routes/etiquetas');

const app = express();

app.use(cors()); // en producción, restringe esto al dominio real del frontend
app.use(express.json());
app.use('/uploads', express.static(process.env.UPLOADS_DIR || './uploads')); // sirve los ficheros subidos

app.use('/api/auth', authRoutes);
app.use('/api/entradas', entradasRoutes);

app.use('/api/etiquetas', etiquetasRoutes);

app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
