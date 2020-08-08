// Copyright 2020 Dead Pixels Collective
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { URLExt, PageConfig } from '@jupyterlab/coreutils';

let DEBUG = false;

/**
 * The path on the server to base application HTML, to be served in an iframe
 */
export const DRAWIO_URL = URLExt.join(
  URLExt.join(PageConfig.getBaseUrl(), 'static'),
  'lab',
  'node_modules/@deathbeds/jupyterlab-drawio-webpack/drawio/src/main/webapp/index.html'
);


const plugin = {
  id: "@deathbeds/jupyterlab-drawio-webpack:plugin",
  activate: async () => {
    console.log(plugin.id, 'activated');
    if(DEBUG) {
      await import("./_static");
    }
  },
  autoStart: true
};

export default plugin;
