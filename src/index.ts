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

import { IMainMenu } from '@jupyterlab/mainmenu';

import { RankedMenu } from '@jupyterlab/ui-components';

import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';

import { ILauncher } from '@jupyterlab/launcher';

import { undoIcon, redoIcon } from '@jupyterlab/ui-components';

import { CommandRegistry } from '@lumino/commands';

import { Token } from '@lumino/coreutils';

import {
  zoominIcon,
  zoomoutIcon,
  toFrontIcon,
  toBackIcon,
  fillColorIcon,
  strokeColorIcon,
  shadowIcon
} from './icons';

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
  requires: [IDefaultFileBrowser, ILayoutRestorer, IMainMenu, ICommandPalette],
  optional: [ILauncher],
  provides: IDrawioTracker,
  activate
};

export default extension;

namespace CommandIDs {
  export const redo = 'drawio:command/redo';
  export const undo = 'drawio:command/undo';
}

function activate(
  app: JupyterFrontEnd,
  defaultBrowser: IDefaultFileBrowser,
  restorer: ILayoutRestorer,
  menu: IMainMenu,
  palette: ICommandPalette,
  launcher: ILauncher | null
): IDrawioTracker {
  const { commands } = app;
  console.log('initialise drawio');
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
    widget.title.iconClass = 'jp-MaterialIcon jp-ImageIcon'; // TODO change

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
      const cwd = defaultBrowser.model.path;
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
      const cwd = defaultBrowser.model.path;
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
    addMenus(app, commands, menu, tracker);
  }

  addCommands(app, tracker);

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
  app: JupyterFrontEnd,
  commands: CommandRegistry,
  menu: IMainMenu,
  tracker: IDrawioTracker
): void {
  const diagram = new RankedMenu({ commands });
  diagram.rootMenu.title.label = 'Diagram';

  // FILE MENU
  // Add new text file creation to the file menu.
  menu.fileMenu.newMenu.addGroup([{ command: 'drawio:create-new' }], 40);
  const fileMenu = new RankedMenu({ commands });
  fileMenu.rootMenu.title.label = 'File';
  fileMenu.addGroup([{ command: 'drawio:create-new' }], 0);
  fileMenu.addGroup(
    [
      { command: 'drawio:export-svg' },
      { command: 'drawio:command/pageSetup' },
      { command: 'drawio:command/print' }
    ],
    1
  );
  const isEnabled = () =>
    tracker.currentWidget !== null &&
    tracker.currentWidget === app.shell.currentWidget;

  // Edit MENU
  menu.editMenu.undoers.undo.add({ id: CommandIDs.undo, isEnabled });
  menu.editMenu.undoers.undo.add({ id: CommandIDs.redo, isEnabled });

  const editMenu = new RankedMenu({ commands });
  editMenu.rootMenu.title.label = 'Edit';
  editMenu.addGroup(
    [{ command: CommandIDs.undo }, { command: CommandIDs.redo }],
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

  // View MENU
  const viewMenu = new RankedMenu({ commands });
  viewMenu.rootMenu.title.label = 'View';
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

  // Arrange MENU
  const arrangeMenu = new RankedMenu({ commands });
  arrangeMenu.rootMenu.title.label = 'Arrange';
  arrangeMenu.addGroup(
    [
      { command: 'drawio:command/toFront' },
      { command: 'drawio:command/toBack' }
    ],
    0
  );

  const direction = new RankedMenu({ commands });
  direction.rootMenu.title.label = 'Direction';
  direction.addGroup(
    [{ command: 'drawio:command/flipH' }, { command: 'drawio:command/flipV' }],
    0
  );
  direction.addGroup([{ command: 'drawio:command/rotation' }], 1);
  arrangeMenu.addGroup(
    [
      { type: 'submenu', submenu: direction.rootMenu },
      { command: 'drawio:command/turn' }
    ],
    1
  );

  const align = new RankedMenu({ commands });
  align.rootMenu.title.label = 'Diagram Align';
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

  const distribute = new RankedMenu({ commands });
  distribute.rootMenu.title.label = 'Distribute';
  distribute.addGroup(
    [
      { command: 'drawio:command/horizontal' },
      { command: 'drawio:command/vertical' }
    ],
    0
  );
  arrangeMenu.addGroup(
    [
      { type: 'submenu', submenu: align.rootMenu },
      { type: 'submenu', submenu: distribute.rootMenu }
    ],
    2
  );

  const navigation = new RankedMenu({ commands });
  navigation.rootMenu.title.label = 'Navigation';
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

  const insert = new RankedMenu({ commands });
  insert.rootMenu.title.label = 'Insert';
  insert.addGroup(
    [
      { command: 'drawio:command/insertLink' },
      { command: 'drawio:command/insertImage' }
    ],
    0
  );

  const layout = new RankedMenu({ commands });
  layout.rootMenu.title.label = 'Layout';
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
      { type: 'submenu', submenu: navigation.rootMenu },
      { type: 'submenu', submenu: insert.rootMenu },
      { type: 'submenu', submenu: layout.rootMenu }
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

  // Extras MENU
  const extrasMenu = new RankedMenu({ commands });
  extrasMenu.rootMenu.title.label = 'Extras';
  extrasMenu.addGroup(
    [
      { command: 'drawio:command/copyConnect' },
      { command: 'drawio:command/collapseExpand' }
    ],
    0
  );
  extrasMenu.addGroup([{ command: 'drawio:command/editDiagram' }], 1);

  diagram.addGroup(
    [
      { type: 'submenu', submenu: fileMenu.rootMenu },
      { type: 'submenu', submenu: editMenu.rootMenu },
      { type: 'submenu', submenu: viewMenu.rootMenu },
      { type: 'submenu', submenu: arrangeMenu.rootMenu },
      { type: 'submenu', submenu: extrasMenu.rootMenu },
      { command: 'drawio:command/about' }
    ],
    0
  );
  menu.addMenu(diagram.rootMenu, true, { rank: 60 });
}

function addCommands(app: JupyterFrontEnd, tracker: IDrawioTracker): void {
  // FILE MENU
  //Not Working: new, open, save, save as, import, export
  //Working: pageSetup, print
  const fileCommands = [
    { name: 'pageSetup', label: 'Page Setup...' },
    { name: 'print', label: 'Print...' } //Ctrl+P
  ];
  fileCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });

  // Edit MENU
  //Not Working:
  //Working:
  //  undo, redo,
  //  cut, copy, paste, delete
  //  Duplicate
  //  Edit data, edit tooltip, Edit style
  //  Edit
  //  Edit link, open link
  //  Select vertices, select edges, select all, select none
  //  lock/unlock
  const editCommands = [
    //{ name: 'undo', label: 'Undo' }, //Ctrl+Z
    //{ name: 'redo', label: 'Redo' }, //Ctrl+Shift+Z
    { name: 'cut', label: 'Cut' }, //Ctrl+X
    { name: 'copy', label: 'Copy' }, //Ctrl+C
    { name: 'paste', label: 'Paste' }, //Ctrl+V
    { name: 'delete', label: 'Delete' },
    { name: 'duplicate', label: 'Duplicate' }, //Ctrl+D
    { name: 'editData', label: 'Edit Data...' }, //Ctrl+M
    { name: 'editTooltip', label: 'Edit Tooltip...' },
    { name: 'editStyle', label: 'Edit Style...' }, //Ctrl+E
    { name: 'edit', label: 'Edit' }, //F2/Enter
    { name: 'editLink', label: 'Edit Link...' },
    { name: 'openLink', label: 'Open Link' },
    { name: 'selectVertices', label: 'Select Vertices' }, //Ctrl+Shift+I
    { name: 'selectEdges', label: 'Select Edges' }, //Ctrl+Shift+E
    { name: 'selectAll', label: 'Select all' }, //Ctrl+A
    { name: 'selectNone', label: 'Select None' }, //Ctrl+Shift+A
    { name: 'lockUnlock', label: 'Lock/Unlock' } //Ctrl+L
  ];
  editCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });
  app.commands.addCommand(CommandIDs.undo, {
    label: 'Undo',
    caption: 'Undo (Ctrl+Z)',
    icon: undoIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('undo').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('undo').funct();
      }
    }
  });
  app.commands.addCommand(CommandIDs.redo, {
    label: 'Redo',
    caption: 'Redo (Ctrl+Shift+Z)',
    icon: redoIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('redo').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('redo').funct();
      }
    }
  });

  // View MENU
  //Not Working:
  //Working:
  //  formatPanel, outline, layers
  //  pageView, pageScale
  //  scrollbars, tooltips
  //  grid, guides
  //  connectionArrows, connectionPoints
  //  resetView, zoomIn, zoomOut
  const viewCommands = [
    { name: 'formatPanel', label: 'Format Panel' }, //Ctrl+Shift+P
    { name: 'outline', label: 'Outline' }, //Ctrl+Shift+O
    { name: 'layers', label: 'Layers' }, //Ctrl+Shift+L
    { name: 'pageView', label: 'Page View' },
    { name: 'pageScale', label: 'Page Scale...' },
    { name: 'scrollbars', label: 'Scrollbars' },
    { name: 'tooltips', label: 'Tooltips' },
    { name: 'grid', label: 'Grid' }, //Ctrl+Shift+G
    { name: 'guides', label: 'Guides' },
    { name: 'connectionArrows', label: 'Connection Arrows' }, //Alt+Shift+A
    { name: 'connectionPoints', label: 'Connection Points' }, //Alt+Shift+P
    { name: 'resetView', label: 'Reset View' } //Ctrl+H
    //{ name: 'zoomIn', label: 'Zoom In' }, //Ctrl+(Numpad)/Alt+Mousewheel
    //{ name: 'zoomOut', label: 'Zoom Out' } //Ctrl-(Numpad)/Alt+Mousewheel
  ];
  viewCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isToggleable: true,
      isToggled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          const act = wdg.getAction(action.name);
          return act.toggleAction ? act.isSelected() : false;
        } else {
          return false;
        }
      },
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });
  app.commands.addCommand('drawio:command/zoomIn', {
    label: 'Zoom In',
    caption: 'Zoom In (Ctrl+(Numpad)/Alt+Mousewheel)',
    icon: zoominIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('zoomIn').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('zoomIn').funct();
      }
    }
  });
  app.commands.addCommand('drawio:command/zoomOut', {
    label: 'Zoom Out',
    caption: 'Zoom Out (Ctrl-(Numpad)/Alt+Mousewheel)',
    icon: zoomoutIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('zoomOut').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('zoomOut').funct();
      }
    }
  });

  // Arrange MENU
  //Not Working:
  //Working:
  //  toFront, toBack
  //  Direction->(flipH, flipV, rotation), turn
  //  Align->(alignCellsRight, alignCellsCenter, alignCellsRight
  //          alignCellsTop, alignCellsMiddle, alignCellsBottom),
  //    Distribute->(horizontal, vertical)
  //  Navigation->(home,
  //               exitGroup, enterGroup
  //               expand, collapse
  //               collapsible),
  //    Insert->(insertLink, insertImage)
  //    Layout->(horizontalFlow, verticalFlow
  //             horizontalTree, verticalTree, radialTree
  //              organic, circle)
  //  group, ungroup, removeFromGroup
  //  clearWaypoints, autosize
  const arrangeCommands = [
    //{ name: 'toFront', label: 'To Front' }, //Ctrl+Shift+F
    //{ name: 'toBack', label: 'To Back' }, //Ctrl+Shift+B
    { name: 'rotation', label: 'Rotation' },
    { name: 'turn', label: 'Rotate 90⁰/Reverse' }, //Ctrl+R
    { name: 'home', label: 'Home' },
    { name: 'exitGroup', label: 'Exit Group' }, //Ctrl+Shift+Home
    { name: 'enterGroup', label: 'Enter Group' }, //Ctrl+Shift+End
    { name: 'expand', label: 'Expand' }, //Ctrl+End
    { name: 'collapse', label: 'Collapse' }, //Ctrl+Home
    { name: 'collapsible', label: 'Collapsible' },
    { name: 'insertLink', label: 'Insert Link...' },
    { name: 'insertImage', label: 'Insert Image...' },
    { name: 'group', label: 'Group' }, //Ctrl+G
    { name: 'ungroup', label: 'Ungroup' }, //Ctrl+Shift+U
    { name: 'removeFromGroup', label: 'Remove from Group' },
    { name: 'clearWaypoints', label: 'Clear Waypoints' }, //Alt+Shift+C
    { name: 'autosize', label: 'Autosize' } //Ctrl+Shift+Y
  ];
  arrangeCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });
  app.commands.addCommand('drawio:command/toFront', {
    label: 'To Front',
    caption: 'To Front (Ctrl+Shift+F)',
    icon: toFrontIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('toFront').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('toFront').funct();
      }
    }
  });
  app.commands.addCommand('drawio:command/toBack', {
    label: 'To Back',
    caption: 'To Back (Ctrl+Shift+B)',
    icon: toBackIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('toBack').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('toBack').funct();
      }
    }
  });

  //Direction
  app.commands.addCommand('drawio:command/flipH', {
    label: 'Flip Horizintal',
    caption: 'Flip Horizintal',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.toggleCellStyles('flipH');
      }
    }
  });
  app.commands.addCommand('drawio:command/flipV', {
    label: 'Flip Vertical',
    caption: 'Flip Vertical',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.toggleCellStyles('flipV');
      }
    }
  });

  //Align
  app.commands.addCommand('drawio:command/alignCellsLeft', {
    label: 'Left Align',
    caption: 'Left Align',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.alignCells('alignCellsLeft');
      }
    }
  });
  app.commands.addCommand('drawio:command/alignCellsCenter', {
    label: 'Center',
    caption: 'Center',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.alignCells('alignCellsCenter');
      }
    }
  });
  app.commands.addCommand('drawio:command/alignCellsRight', {
    label: 'Right Align',
    caption: 'Right Align',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.alignCells('alignCellsRight');
      }
    }
  });
  app.commands.addCommand('drawio:command/alignCellsTop', {
    label: 'Top Align',
    caption: 'Top Align',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.alignCells('alignCellsTop');
      }
    }
  });
  app.commands.addCommand('drawio:command/alignCellsMiddle', {
    label: 'Middle',
    caption: 'Middle',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.alignCells('alignCellsMiddle');
      }
    }
  });
  app.commands.addCommand('drawio:command/alignCellsBottom', {
    label: 'Bottom Align',
    caption: 'Bottom Align',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.alignCells('alignCellsBottom');
      }
    }
  });

  //Distribute
  app.commands.addCommand('drawio:command/horizontal', {
    label: 'Horizontal',
    caption: 'Horizontal',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.distributeCells(true);
      }
    }
  });
  app.commands.addCommand('drawio:command/vertical', {
    label: 'Vertical',
    caption: 'Vertical',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.distributeCells(false);
      }
    }
  });

  //Layout
  app.commands.addCommand('drawio:command/horizontalFlow', {
    label: 'Horizontal Flow',
    caption: 'Horizontal Flow',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.layoutFlow('horizontalFlow');
      }
    }
  });
  app.commands.addCommand('drawio:command/verticalFlow', {
    label: 'Vertical Flow',
    caption: 'Vertical Flow',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.layoutFlow('verticalFlow');
      }
    }
  });
  app.commands.addCommand('drawio:command/horizontalTree', {
    label: 'Horizontal Tree',
    caption: 'Horizontal Tree',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.horizontalTree();
      }
    }
  });
  app.commands.addCommand('drawio:command/verticalTree', {
    label: 'Vertical Tree',
    caption: 'Vertical Tree',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.verticalTree();
      }
    }
  });
  app.commands.addCommand('drawio:command/radialTree', {
    label: 'Radial Tree',
    caption: 'Radial Tree',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.radialTree();
      }
    }
  });
  app.commands.addCommand('drawio:command/organic', {
    label: 'Organic',
    caption: 'Organic',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.organic();
      }
    }
  });
  app.commands.addCommand('drawio:command/circle', {
    label: 'Circle',
    caption: 'Circle',
    isEnabled: () =>
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget,
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.circle();
      }
    }
  });

  // Extras MENU
  //Not Working:
  //Working:
  //  copyConnect, collapseExpand
  //  editDiagram
  const extrasCommands = [
    { name: 'copyConnect', label: 'Copy on Connect' },
    { name: 'collapseExpand', label: 'Collapse/Expand' },
    { name: 'editDiagram', label: 'Edit Diagram...' }
  ];
  extrasCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });

  // Help MENU
  //Not Working: help
  //Working:
  //  about
  const helpCommands = [{ name: 'about', label: 'About GraphEditor' }];
  helpCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });

  /**************************************************************************************
   *                                     Toolbar                                        *
   **************************************************************************************/
  //Working: fitWindow, fitPageWidth, fitPage, fitTwoPages, customZoom
  const toolbarCommands = [
    { name: 'fitWindow', label: 'Fit Window' }, //Ctrl+Shift+H
    { name: 'fitPageWidth', label: 'Page Width' },
    { name: 'fitPage', label: 'One Page' }, //Ctrl+J
    { name: 'fitTwoPages', label: 'Two Pages' }, //Ctrl+Shift+J
    { name: 'customZoom', label: 'Custom...' } //Ctrl+O
  ];
  toolbarCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });
  app.commands.addCommand('drawio:command/fillColor', {
    label: 'Fill Color',
    caption: 'Fill Color',
    icon: fillColorIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        console.debug('fill Color:', wdg.getAction('fillColor').enabled);
        return wdg.getAction('fillColor').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('fillColor').funct();
      }
    }
  });
  app.commands.addCommand('drawio:command/strokeColor', {
    label: 'Fill Stroke Color',
    caption: 'Fill Stroke Color',
    icon: strokeColorIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('strokeColor').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('strokeColor').funct();
      }
    }
  });
  app.commands.addCommand('drawio:command/shadow', {
    label: 'Shadow',
    caption: 'Shadow',
    icon: shadowIcon,
    isEnabled: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        return wdg.getAction('shadow').enabled;
      } else {
        return false;
      }
    },
    execute: () => {
      if (
        tracker.currentWidget !== null &&
        tracker.currentWidget === app.shell.currentWidget
      ) {
        const wdg = app.shell.currentWidget as DrawIODocumentWidget;
        wdg.getAction('shadow').funct();
      }
    }
  });

  /**************************************************************************************
   *                                     Other                                          *
   **************************************************************************************/
  const otherCommands = [
    { name: 'addWaypoint', label: 'Add Waypoint' },
    { name: 'autosave', label: 'Autosave' },
    { name: 'backgroundColor', label: 'Background Color' },
    { name: 'bold', label: 'Bold' },
    { name: 'borderColor', label: 'Border Color' },
    { name: 'clearDefaultStyle', label: 'Clear Default Style' },
    { name: 'curved', label: 'Curved' },
    { name: 'dashed', label: 'Dashed' },
    { name: 'deleteAll', label: 'Delete All' },
    { name: 'dotted', label: 'Dotted' },
    { name: 'fontColor', label: 'Font Color' },
    { name: 'formattedText', label: 'Formatted Text' },
    { name: 'gradientColor', label: 'Gradient Color' },
    { name: 'image', label: 'Image' },
    { name: 'italic', label: 'Italic' },
    { name: 'link', label: 'Link' },
    { name: 'pasteHere', label: 'Paste Here' },
    { name: 'preview', label: 'Preview' },
    { name: 'removeWaypoint', label: 'Remove Waypoint' },
    { name: 'rounded', label: 'Rounded' },
    { name: 'setAsDefaultStyle', label: 'Set As Default Style' },
    { name: 'sharp', label: 'Sharp' },
    { name: 'solid', label: 'Solid' },
    { name: 'subscript', label: 'Subscript' },
    { name: 'superscript', label: 'Superscript' },
    { name: 'toggleRounded', label: 'Toggle Rounded' },
    { name: 'underline', label: 'Underline' },
    { name: 'wordWrap', label: 'Word Wrap' }
  ];
  otherCommands.forEach(action => {
    app.commands.addCommand('drawio:command/' + action.name, {
      label: action.label,
      caption: action.label,
      isEnabled: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          return wdg.getAction(action.name).enabled;
        } else {
          return false;
        }
      },
      execute: () => {
        if (
          tracker.currentWidget !== null &&
          tracker.currentWidget === app.shell.currentWidget
        ) {
          const wdg = app.shell.currentWidget as DrawIODocumentWidget;
          wdg.getAction(action.name).funct();
        }
      }
    });
  });
}
