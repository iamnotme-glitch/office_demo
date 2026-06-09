import app from './app.js';

const port = Number(process.env.PORT ?? 19320);

if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Invoice app running at http://localhost:${port}`);
  });
}

export default app;
