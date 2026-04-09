import app from './app';
import { env } from './config/env';

app.listen(env.port, () => {
  console.log(`✓ Backend running at http://localhost:${env.port}${env.apiPrefix}`);
});
