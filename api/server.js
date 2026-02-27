import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAvailableStates, getCalendarByState, getRaceDetails } from './corridasbr.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const app = express();
const requestedPort = Number(process.env.PORT || 8787);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'o-amador-corridas-api',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/states', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const data = await getAvailableStates({ forceRefresh });
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/calendar', async (req, res) => {
  const state = req.query.state || 'SC';
  const includeDetails = req.query.details === '1';
  const forceRefresh = req.query.refresh === '1';
  const limitRaw = req.query.limit;

  try {
    const calendar = await getCalendarByState(state, { forceRefresh });

    let races = calendar.races;
    if (limitRaw !== undefined) {
      const limit = Number(limitRaw);
      if (Number.isNaN(limit) || limit < 1) {
        return res.status(400).json({ error: 'Parâmetro "limit" inválido. Use inteiro positivo.' });
      }
      races = races.slice(0, limit);
    }

    if (!includeDetails) {
      return res.json({
        ...calendar,
        count: races.length,
        races
      });
    }

    const withDetails = [];
    for (const race of races) {
      try {
        const details = await getRaceDetails(state, race.id, { forceRefresh });
        withDetails.push({ ...race, details });
      } catch (error) {
        withDetails.push({ ...race, details_error: error.message });
      }
    }

    res.json({
      ...calendar,
      count: withDetails.length,
      races: withDetails
    });
  } catch (error) {
    const statusCode = /inválido/i.test(error.message) ? 400 : 502;
    res.status(statusCode).json({ error: error.message });
  }
});

app.get('/api/race/:state/:id', async (req, res) => {
  const { state, id } = req.params;
  const forceRefresh = req.query.refresh === '1';

  try {
    const data = await getRaceDetails(state, id, { forceRefresh });
    res.json(data);
  } catch (error) {
    const statusCode = /inválido/i.test(error.message) ? 400 : 502;
    res.status(statusCode).json({ error: error.message });
  }
});

// Serve o site estático na mesma aplicação da API.
app.use(express.static(rootDir, { extensions: ['html'] }));

app.use('/api', (_req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    available_routes: ['/api/health', '/api/states', '/api/calendar?state=SC', '/api/race/SC/53035']
  });
});

app.use((_req, res) => {
  res.status(404).type('text/plain').send('Página não encontrada.');
});

function startServer(port, retriesLeft = 10) {
  const server = app.listen(port, () => {
    console.log(`Site + API no ar em http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE' && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Porta ${port} ocupada. Tentando ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    console.error('Falha ao subir servidor:', error);
    process.exit(1);
  });
}

startServer(requestedPort);
