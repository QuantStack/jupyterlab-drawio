// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette, InstanceTracker, IInstanceTracker
} from '@jupyterlab/apputils';

import {
  PathExt
} from '@jupyterlab/coreutils';

import {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

// import {
//   drawio, drawioFactory, IDrawioTracker
// } from '@jupyterlab/drawio';

import {
  DrawioWidget, DrawioFactory
} from './editor';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  IEditMenu, IFileMenu, IMainMenu, IRunMenu, IViewMenu
} from '@jupyterlab/mainmenu';

import {
  JSONObject, Token
} from '@phosphor/coreutils';

import {
  Menu
} from '@phosphor/widgets';

/**
 * The class name for the text editor icon from the default theme.
 */
const EDITOR_ICON_CLASS = 'jp-TextEditorIcon';

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
  const { commands, restored } = app;
  const tracker = new InstanceTracker<DrawioWidget>({ namespace });

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
      console.log(wdg._editor.editor.graph.getSvg());
      // commands.execute('docmanager:open', {
      //   path: model.path, factory: () {

      //   }
      // })
      // console.log(app.shell.currentWidget)
    });
  };

  // Add a command for creating a new text file.
  commands.addCommand('drawio:create-new', {
    label: 'Diagram',
    caption: 'Create a new diagram file',
    execute: () => {
      let cwd = browserFactory.defaultBrowser.model.path;
      return createNewDIO(cwd);
    }
  });

  commands.addCommand('drawio:export-svg', {
    label: 'Export SVG',
    caption: 'Export diagram as SVG',
    execute: () => {
      let cwd = browserFactory.defaultBrowser.model.path;
      return createNewSVG(cwd);
    }
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    launcher.add({
      displayName: 'MXGraph',
      name: 'MXGraph',
      iconClass: 'jp-MaterialIcon jp-ImageIcon',
      callback: createNewDIO,
      rank: 1,
      category: 'Other'
    });
  }

  if (menu) {
    // Add new text file creation to the file menu.
    menu.fileMenu.newMenu.addGroup([{ command: 'drawio:create-new' }], 40);
    let args = { 'format': 'SVG', 'label': 'SVG', 'isPalette': true };
    palette.addItem({ command: 'drawio:export-svg', category: 'Notebook Operations', args: args });
    menu.fileMenu.addGroup([{ command: 'drawio:export-svg'}], 40);
  }

  return tracker;
}