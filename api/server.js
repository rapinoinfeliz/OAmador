import express from 'express';
import cors from 'cors';
import { getAvailableStates, getCalendarByState, getRaceDetails } from './corridasbr.js';

const app = express();
const port = Number(process.env.PORT || 8787);

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

app.use((_req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    available_routes: ['/api/health', '/api/states', '/api/calendar?state=SC', '/api/race/SC/53035']
  });
});

app.listen(port, () => {
  console.log(`API no ar em http://localhost:${port}`);
});
