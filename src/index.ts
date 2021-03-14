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
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
  WidgetTracker,
  IWidgetTracker
} from '@jupyterlab/apputils';

import { IMainMenu, JupyterLabMenu } from '@jupyterlab/mainmenu';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ILauncher } from '@jupyterlab/launcher';

import { CommandRegistry } from '@lumino/commands';

import { Token } from '@lumino/coreutils';

import { DrawIODocumentWidget } from './editor';

import { DrawIOFactory } from './factory';

/**
 * The name of the factory that creates editor widgets.
 */
const FACTORY = 'Drawio';

type IDrawioTracker = IWidgetTracker<DrawIODocumentWidget>;

export const IDrawioTracker = new Token<IDrawioTracker>('drawio/tracki');

/**
 * The editor tracker extension.
 */
const extension: JupyterFrontEndPlugin<IDrawioTracker> = {
  id: '@jupyterlab/drawio-extension:plugin',
  autoStart: true,
  requires: [IFileBrowserFactory, ILayoutRestorer, IMainMenu, ICommandPalette],
  optional: [ILauncher],
  provides: IDrawioTracker,
  activate
};

export default extension;

function activate(
  app: JupyterFrontEnd,
  browserFactory: IFileBrowserFactory,
  restorer: ILayoutRestorer,
  menu: IMainMenu,
  palette: ICommandPalette,
  launcher: ILauncher | null
): IDrawioTracker {
  const { commands } = app;

  const namespace = 'drawio';
  const tracker = new WidgetTracker<DrawIODocumentWidget>({ namespace });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: widget => ({ path: widget.context.path, factory: FACTORY }),
    name: widget => widget.context.path
  });

  const factory = new DrawIOFactory({
    name: FACTORY,
    fileTypes: ['dio', 'drawio'],
    defaultFor: ['dio', 'drawio'],
    commands: app.commands
  });

  factory.widgetCreated.connect((sender, widget) => {
    widget.title.icon = 'jp-MaterialIcon jp-ImageIcon'; // TODO change

    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    tracker.add(widget);
  });
  app.docRegistry.addWidgetFactory(factory);

  // register the filetype
  app.docRegistry.addFileType({
    name: 'drawio',
    displayName: 'Diagram',
    mimeTypes: ['application/dio', 'application/drawio'],
    extensions: ['.dio', '.drawio'],
    iconClass: 'jp-MaterialIcon jp-ImageIcon',
    fileFormat: 'text',
    contentType: 'file'
  });

  // Add a command for creating a new diagram file.
  commands.addCommand('drawio:create-new', {
    label: 'Diagram',
    iconClass: 'jp-MaterialIcon jp-ImageIcon',
    caption: 'Create a new diagram file',
    execute: () => {
      const cwd = browserFactory.defaultBrowser.model.path;
      commands
        .execute('docmanager:new-untitled', {
          path: cwd,
          type: 'file',
          ext: '.dio'
        })
        .then(model =>
          commands.execute('docmanager:open', {
            path: model.path,
            factory: FACTORY
          })
        );
    }
  });

  commands.addCommand('drawio:export-svg', {
    label: 'Export diagram as SVG',
    caption: 'Export diagram as SVG',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      const cwd = browserFactory.defaultBrowser.model.path;
      commands
        .execute('docmanager:new-untitled', {
          path: cwd,
          type: 'file',
          ext: '.svg'
        })
        .then(model => {
          const wdg = app.shell.currentWidget as any;
          model.content = wdg.getSVG();
          model.format = 'text';
          app.serviceManager.contents.save(model.path, model);
        });
    }
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
    addMenus(commands, menu, tracker);
  }

  if (palette) {
    const args = { format: 'SVG', label: 'SVG', isPalette: true };
    palette.addItem({
      command: 'drawio:export-svg',
      category: 'Notebook Operations',
      args: args
    });
  }

  return tracker;
}

function addMenus(
  commands: CommandRegistry,
  menu: IMainMenu,
  tracker: IDrawioTracker
): void {
  // FILE MENU
  // Add new text file creation to the file menu.
  menu.fileMenu.newMenu.addGroup([{ command: 'drawio:create-new' }], 40);
  menu.fileMenu.addGroup(
    [
      { command: 'drawio:export-svg' },
      { command: 'drawio:command/pageSetup' },
      { command: 'drawio:command/print' }
    ],
    40
  );

  // Edit MENU
  menu.editMenu.undoers.add({
    tracker,
    undo: (widget: any) => widget.execute('undo'),
    redo: (widget: any) => widget.execute('redo')
  } as any);

  const editMenu = new JupyterLabMenu({ commands });
  editMenu.menu.title.label = 'Diagram Edit';
  editMenu.addGroup(
    [{ command: 'drawio:command/undo' }, { command: 'drawio:command/redo' }],
    0
  );
  editMenu.addGroup(
    [
      { command: 'drawio:command/cut' },
      { command: 'drawio:command/copy' },
      { command: 'drawio:command/paste' },
      { command: 'drawio:command/delete' }
    ],
    1
  );
  editMenu.addGroup([{ command: 'drawio:command/duplicate' }], 2);
  editMenu.addGroup(
    [
      { command: 'drawio:command/editData' },
      { command: 'drawio:command/editTooltip' },
      { command: 'drawio:command/editStyle' }
    ],
    3
  );
  editMenu.addGroup([{ command: 'drawio:command/edit' }], 4);
  editMenu.addGroup(
    [
      { command: 'drawio:command/editLink' },
      { command: 'drawio:command/openLink' }
    ],
    5
  );
  editMenu.addGroup(
    [
      { command: 'drawio:command/selectVertices' },
      { command: 'drawio:command/selectEdges' },
      { command: 'drawio:command/selectAll' },
      { command: 'drawio:command/selectNone' }
    ],
    6
  );
  editMenu.addGroup([{ command: 'drawio:command/lockUnlock' }], 7);
  menu.addMenu(editMenu.menu, { rank: 20 });

  // View MENU
  const viewMenu = new JupyterLabMenu({ commands });
  viewMenu.menu.title.label = 'Diagram View';
  viewMenu.addGroup(
    [
      { command: 'drawio:command/formatPanel' },
      { command: 'drawio:command/outline' },
      { command: 'drawio:command/layers' }
    ],
    0
  );
  viewMenu.addGroup(
    [
      { command: 'drawio:command/pageView' },
      { command: 'drawio:command/pageScale' }
    ],
    1
  );
  viewMenu.addGroup(
    [
      { command: 'drawio:command/scrollbars' },
      { command: 'drawio:command/tooltips' }
    ],
    2
  );
  viewMenu.addGroup(
    [{ command: 'drawio:command/grid' }, { command: 'drawio:command/guides' }],
    3
  );
  viewMenu.addGroup(
    [
      { command: 'drawio:command/connectionArrows' },
      { command: 'drawio:command/connectionPoints' }
    ],
    4
  );
  viewMenu.addGroup(
    [
      { command: 'drawio:command/resetView' },
      { command: 'drawio:command/zoomIn' },
      { command: 'drawio:command/zoomOut' }
    ],
    5
  );
  menu.addMenu(viewMenu.menu, { rank: 20 });

  // Arrange MENU
  const arrangeMenu = new JupyterLabMenu({ commands });
  arrangeMenu.menu.title.label = 'Diagram Arrange';
  arrangeMenu.addGroup(
    [
      { command: 'drawio:command/toFront' },
      { command: 'drawio:command/toBack' }
    ],
    0
  );

  const direction = new JupyterLabMenu({ commands });
  direction.menu.title.label = 'Direction';
  direction.addGroup(
    [{ command: 'drawio:command/flipH' }, { command: 'drawio:command/flipV' }],
    0
  );
  direction.addGroup([{ command: 'drawio:command/rotation' }], 1);
  arrangeMenu.addGroup(
    [
      { type: 'submenu', submenu: direction.menu },
      { command: 'drawio:command/turn' }
    ],
    1
  );

  const align = new JupyterLabMenu({ commands });
  align.menu.title.label = 'Diagram Align';
  align.addGroup(
    [
      { command: 'drawio:command/alignCellsLeft' },
      { command: 'drawio:command/alignCellsCenter' },
      { command: 'drawio:command/alignCellsRight' }
    ],
    0
  );
  align.addGroup(
    [
      { command: 'drawio:command/alignCellsTop' },
      { command: 'drawio:command/alignCellsMiddle' },
      { command: 'drawio:command/alignCellsBottom' }
    ],
    1
  );

  const distribute = new JupyterLabMenu({ commands });
  distribute.menu.title.label = 'Distribute';
  distribute.addGroup(
    [
      { command: 'drawio:command/horizontal' },
      { command: 'drawio:command/vertical' }
    ],
    0
  );
  arrangeMenu.addGroup(
    [
      { type: 'submenu', submenu: align.menu },
      { type: 'submenu', submenu: distribute.menu }
    ],
    2
  );

  const navigation = new JupyterLabMenu({ commands });
  navigation.menu.title.label = 'Navigation';
  navigation.addGroup([{ command: 'drawio:command/home' }], 0);
  navigation.addGroup(
    [
      { command: 'drawio:command/exitGroup' },
      { command: 'drawio:command/enterGroup' }
    ],
    1
  );
  navigation.addGroup(
    [
      { command: 'drawio:command/expand' },
      { command: 'drawio:command/collapse' }
    ],
    2
  );
  navigation.addGroup([{ command: 'drawio:command/collapsible' }], 3);

  const insert = new JupyterLabMenu({ commands });
  insert.menu.title.label = 'Insert';
  insert.addGroup(
    [
      { command: 'drawio:command/insertLink' },
      { command: 'drawio:command/insertImage' }
    ],
    0
  );

  const layout = new JupyterLabMenu({ commands });
  layout.menu.title.label = 'Layout';
  layout.addGroup(
    [
      { command: 'drawio:command/horizontalFlow' },
      { command: 'drawio:command/verticalFlow' }
    ],
    0
  );
  layout.addGroup(
    [
      { command: 'drawio:command/horizontalTree' },
      { command: 'drawio:command/verticalTree' },
      { command: 'drawio:command/radialTree' }
    ],
    1
  );
  layout.addGroup(
    [
      { command: 'drawio:command/organic' },
      { command: 'drawio:command/circle' }
    ],
    2
  );
  arrangeMenu.addGroup(
    [
      { type: 'submenu', submenu: navigation.menu },
      { type: 'submenu', submenu: insert.menu },
      { type: 'submenu', submenu: layout.menu }
    ],
    3
  );

  arrangeMenu.addGroup(
    [
      { command: 'drawio:command/group' },
      { command: 'drawio:command/ungroup' },
      { command: 'drawio:command/removeFromGroup' }
    ],
    4
  );

  arrangeMenu.addGroup(
    [
      { command: 'drawio:command/clearWaypoints' },
      { command: 'drawio:command/autosize' }
    ],
    5
  );

  menu.addMenu(arrangeMenu.menu, { rank: 60 });

  // Extras MENU
  const extrasMenu = new JupyterLabMenu({ commands });
  extrasMenu.menu.title.label = 'Diagram Extras';
  extrasMenu.addGroup(
    [
      { command: 'drawio:command/copyConnect' },
      { command: 'drawio:command/collapseExpand' }
    ],
    0
  );
  extrasMenu.addGroup([{ command: 'drawio:command/editDiagram' }], 1);
  menu.addMenu(extrasMenu.menu, { rank: 70 });

  // Help MENU
  menu.helpMenu.addGroup([{ command: 'drawio:command/about' }], 77);
}
