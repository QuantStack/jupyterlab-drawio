import { URLExt, PageConfig } from '@jupyterlab/coreutils';
/**
 * The path on the server to base application HTML, to be served in an iframe
 */
export const DRAWIO_URL = URLExt.join(
  URLExt.join(PageConfig.getBaseUrl(), 'static'),
  'lab',
  'node_modules/@deathbeds/jupyterlab-drawio-webpack/drawio/src/main/webapp/index.html'
);
