import app from './app.js';
import { assertServerStartupEnv, env } from './config/env.js';

assertServerStartupEnv();

app.listen(env.port, () => {
  console.info(`FieldTrack API server listening on http://localhost:${env.port}`);
});
