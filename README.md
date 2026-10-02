# Frame frontend

This is a standalone React + TypeScript app. It talks directly to the separately deployed Frame API.

## Local run

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

During local development, Vite proxies `/api` to `http://localhost:3000`, so it works even when Vite selects port 5174 or another available port. Build for production with `npm run build`; `npm run preview` serves the built frontend locally.

For deployment, set `VITE_API_URL` in the frontend build environment to the public backend URL, without a trailing slash. This is a public URL, not a secret. Configure the backend's `FRONTEND_ORIGINS` to include the deployed frontend origin.
