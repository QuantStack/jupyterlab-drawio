// Copyright 2018 Wolf Vollprecht
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

import { IStatusBar } from '@jupyterlab/statusbar';

import {
  ILayoutRestorer,
  JupyterLab,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { DEBUG } from './editor';

import * as IO from './io';
import { DrawioStatus } from './status';
import { NS } from '.';

import {
  IDiagramManager,
  TEXT_FACTORY,
  BINARY_FACTORY,
  JSON_FACTORY,
  CommandIds,
} from './tokens';
import { DiagramManager } from './manager';

/**
 * The editor tracker extension.
 */
const plugin: JupyterFrontEndPlugin<IDiagramManager> = {
  activate,
  id: '@deathbeds/jupyterlab-drawio:plugin',
  requires: [
    IFileBrowserFactory,
    ILayoutRestorer,
    IMainMenu,
    ICommandPalette,
    ISettingRegistry,
  ],
  optional: [ILauncher, IStatusBar],
  provides: IDiagramManager,
  autoStart: true,
};

export default plugin;

function activate(
  app: JupyterLab,
  browserFactory: IFileBrowserFactory,
  restorer: ILayoutRestorer,
  menu: IMainMenu,
  palette: ICommandPalette,
  settingsRegistry: ISettingRegistry,
  launcher: ILauncher | null,
  statusBar: IStatusBar | null
): IDiagramManager {
  const manager = new DiagramManager({
    app,
    restorer,
    palette,
    browserFactory,
  });
  let statusItem: DrawioStatus | null = null;

  if (statusBar) {
    statusItem = new DrawioStatus(manager.status);
    statusBar.registerStatusItem(`${NS}:status`, {
      item: statusItem,
      align: 'right',
      rank: 3,
      isActive: () => manager.activeWidget != null,
    });
  }

  // add first-party file types
  for (const format of IO.ALL_FORMATS) {
    manager.addFormat(format);
  }

  settingsRegistry
    .load(plugin.id)
    .then((loadedSettings) => {
      DEBUG && console.warn('settings loaded', loadedSettings.composite);
      manager.settings = loadedSettings;

      // create the trackers
      manager.initTracker('text', TEXT_FACTORY, 'drawio-text');
      manager.initTracker('base64', BINARY_FACTORY, 'drawio-binary');
      manager.initTracker('notebook', JSON_FACTORY, 'drawio-notebook');
    })
    .catch((err) => console.error(err));

  // Add a launcher item if the launcher is available.
  if (launcher) {
    launcher.add({
      command: CommandIds.createNew,
      rank: 1,
      category: 'Other',
    });
  }

  if (menu) {
    // Add new text file creation to the file menu.
    menu.fileMenu.newMenu.addGroup([{ command: 'drawio:create-new' }], 40);
  }

  // this is very odd, and probably can't be reused. Use the manager pattern?
  return manager;
}
