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

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette, InstanceTracker, IInstanceTracker
} from '@jupyterlab/apputils';

import {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  Token
} from '@phosphor/coreutils';

import {
  DrawioWidget, DrawioFactory
} from './editor';

/**
 * The name of the factory that creates editor widgets.
 */
const FACTORY = 'Drawio';

interface IDrawioTracker extends IInstanceTracker<DrawioWidget> {}

export
const IDrawioTracker = new Token<IDrawioTracker>('drawio/tracki');

/**
 * The editor tracker extension.
 */
const plugin: JupyterLabPlugin<IDrawioTracker> = {
  activate,
  id: '@jupyterlab/drawio-extension:plugin',
  requires: [IFileBrowserFactory, ILayoutRestorer, IMainMenu, ICommandPalette],
  optional: [ILauncher],
  provides: IDrawioTracker,
  autoStart: true
};

export default plugin;

function activate(app: JupyterLab,
                  browserFactory: IFileBrowserFactory,
                  restorer: ILayoutRestorer, 
                  menu: IMainMenu,
                  palette: ICommandPalette,
                  launcher: ILauncher | null
    ): IDrawioTracker {
  const namespace = 'drawio';
  const factory = new DrawioFactory({ name: FACTORY, fileTypes: ['dio'], defaultFor: ['dio'] });
  const { commands } = app;
  const tracker = new InstanceTracker<DrawioWidget>({ namespace });

  /**
   * Whether there is an active DrawIO editor.
   */
  function isEnabled(): boolean {
    return tracker.currentWidget !== null &&
           tracker.currentWidget === app.shell.currentWidget;
  }

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  factory.widgetCreated.connect((sender, widget) => {
    widget.title.icon = 'jp-MaterialIcon jp-ImageIcon'; // TODO change

    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => { tracker.save(widget); });
    tracker.add(widget);
  });
  app.docRegistry.addWidgetFactory(factory);

  // register the filetype
  app.docRegistry.addFileType({
      name: 'dio',
      displayName: 'Diagram',
      mimeTypes: ['application/dio'],
      extensions: ['.dio'],
      iconClass: 'jp-MaterialIcon jp-ImageIcon',
      fileFormat: 'text'
  });

  // Function to create a new untitled diagram file, given
  // the current working directory.
  const createNewDIO = (cwd: string) => {
    return commands.execute('docmanager:new-untitled', {
      path: cwd, type: 'file', ext: '.dio'
    }).then(model => {
      return commands.execute('docmanager:open', {
        path: model.path, factory: FACTORY
      });
    });
  };

  const createNewSVG = (cwd: string) => {
    return commands.execute('docmanager:new-untitled', {
      path: cwd, type: 'file', ext: '.svg'
    }).then(model => {
      let wdg = app.shell.currentWidget as any;
      model.content = wdg.getSVG();
      model.format = 'text'
      app.serviceManager.contents.save(model.path, model);
    });
  };

  // Add a command for creating a new diagram file.
  commands.addCommand('drawio:create-new', {
    label: 'Diagram',
    iconClass: 'jp-MaterialIcon jp-ImageIcon',
    caption: 'Create a new diagram file',
    execute: () => {
      let cwd = browserFactory.defaultBrowser.model.path;
      return createNewDIO(cwd);
    }
  });

  commands.addCommand('drawio:export-svg', {
    label: 'Export diagram as SVG',
    caption: 'Export diagram as SVG',
    execute: () => {
      let cwd = browserFactory.defaultBrowser.model.path;
      return createNewSVG(cwd);
    },
    isEnabled
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    launcher.add({
      command: 'drawio:create-new',
      rank: 1,
      category: 'Other'
    });
  }

  if (menu) {
    // Add new text file creation to the file menu.
    menu.fileMenu.newMenu.addGroup([{ command: 'drawio:create-new' }], 40);
    //palette.addItem({ command: 'drawio:export-svg', category: 'Notebook Operations', args: args });
    menu.fileMenu.addGroup([{ command: 'drawio:export-svg'}], 40);
  }

  if (palette) {
    let args = { 'format': 'SVG', 'label': 'SVG', 'isPalette': true };
    palette.addItem({ command: 'drawio:export-svg', category: 'Notebook Operations', args: args });
  }

  return tracker;
}
