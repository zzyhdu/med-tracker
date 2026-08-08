import express from 'express';
import { pool } from './db.js';
import { config } from './config.js';
import { errorMiddleware } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { drugsRouter } from './routes/drugs.js';
import { profilesRouter } from './routes/profiles.js';
import { trackersRouter } from './routes/trackers.js';

const app = express();

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', authRouter);
app.use('/api/drugs', drugsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/trackers', trackersRouter);

app.use(errorMiddleware);

try {
  await pool.query('select 1');
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`med-tracker API listening on port ${config.port}`);
  });
} catch (error) {
  console.error('Unable to connect to PostgreSQL', error);
  process.exit(1);
}
