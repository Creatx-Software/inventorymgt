import app from './app';
import { env } from './config/env';

app.listen(env.port, '0.0.0.0', () => {
  console.log(`✓ Backend running at http://0.0.0.0:${env.port}${env.apiPrefix}`);
});
