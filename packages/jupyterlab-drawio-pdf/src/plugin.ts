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

import { JupyterLab, JupyterFrontEndPlugin } from '@jupyterlab/application';

import { IDiagramManager } from '@deathbeds/jupyterlab-drawio/lib/tokens';

import { PLUGIN_ID } from '.';

import { PDF_BRANDED, PDF_PLAIN } from './io';

/**
 * The editor tracker extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  activate,
  id: PLUGIN_ID,
  requires: [IDiagramManager],
  autoStart: true,
};

export default plugin;

function activate(app: JupyterLab, diagrams: IDiagramManager) {
  console.log('activating', PLUGIN_ID);
  diagrams.addFormat(PDF_PLAIN);
  diagrams.addFormat(PDF_BRANDED);
  console.log('activated', PLUGIN_ID);
}
