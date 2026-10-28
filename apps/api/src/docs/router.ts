/** Local Swagger UI assets and the versioned JSON specification; never acquires a database client. */
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiV1 } from './openapi.v1.js';
/** Keeps vendor assets local and leaves unknown docs paths to the application's safe JSON 404 handler. */
export function createDocsRouter(): Router {
  const router = Router();
  const options: swaggerUi.SwaggerUiOptions = {
    customSiteTitle: 'Transaction Ledger API v1',
    swaggerUrl: '/api/docs/openapi.v1.json',
    swaggerOptions: {
      validatorUrl: null,
      docExpansion: 'list',
      displayRequestDuration: true,
      tryItOutEnabled: false,
      persistAuthorization: false,
    },
  };
  // Register the versioned specification before static assets/UI; no filesystem path or environment is exposed.
  router.get('/openapi.v1.json', (_request, response) => {
    response.set('Cache-Control', 'no-cache').json(openApiV1);
  });
  const ui = swaggerUi.setup(undefined, options);
  router.get('/', (request, response, next) => {
    // Relative vendor asset URLs need a trailing slash; /api/docs remains the public entry point.
    if (!request.originalUrl.split('?')[0]?.endsWith('/')) {
      response.redirect(308, '/api/docs/');
      return;
    }
    ui(request, response, next);
  });
  router.get(
    [
      '/swagger-ui.css',
      '/swagger-ui-bundle.js',
      '/swagger-ui-standalone-preset.js',
      '/swagger-ui-init.js',
      '/favicon-16x16.png',
      '/favicon-32x32.png',
    ],
    ...swaggerUi.serveFiles(undefined, options),
  );
  return router;
}
