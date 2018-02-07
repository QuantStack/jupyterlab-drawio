// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

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
  DrawioWidget, DrawioFactory
} from './editor';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  Token
} from '@phosphor/coreutils';

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
  requires: [IFileBrowserFactory, ILayoutRestorer],
  optional: [ICommandPalette, ILauncher, IMainMenu],
  provides: IDrawioTracker,
  autoStart: true
};

export default plugin;

function activate(app: JupyterLab,
                  browserFactory: IFileBrowserFactory, restorer: ILayoutRestorer,
                  palette: ICommandPalette | null, launcher: ILauncher | null, menu: IMainMenu | null): IDrawioTracker {
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
      let p = app.serviceManager.contents.save(model.path, model);
    });
  };

  // Add a command for creating a new diagram file.
  commands.addCommand('drawio:create-new', {
    label: 'Diagram',
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
      displayName: 'Diagram',
      name: 'diagram',
      iconClass: 'jp-MaterialIcon jp-ImageIcon',
      callback: createNewDIO,
      rank: 1,
      category: 'Other'
    });
  }

  if (menu) {
    // Add new text file creation to the file menu.
    menu.fileMenu.newMenu.addGroup([{ command: 'drawio:create-new' }], 40);
    //let args = { 'format': 'SVG', 'label': 'SVG', 'isPalette': true };
    //palette.addItem({ command: 'drawio:export-svg', category: 'Notebook Operations', args: args });
    menu.fileMenu.addGroup([{ command: 'drawio:export-svg'}], 40);
  }

  if (palette) {
    palette.addItem({ command: 'drawio:export-svg', category: 'DrawIO' });
  }

  return tracker;
}
