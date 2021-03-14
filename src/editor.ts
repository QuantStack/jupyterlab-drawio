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

import { DocumentRegistry, DocumentWidget } from '@jupyterlab/docregistry';

import { MainMenu, JupyterLabMenu } from '@jupyterlab/mainmenu';

import { IChangedArgs, PathExt } from '@jupyterlab/coreutils';

import { CommandRegistry } from '@lumino/commands';

import { Signal } from '@lumino/signaling';

import { DrawIOWidget } from './widget';

import { DrawIOToolbarButton } from './toolbar';

const DIRTY_CLASS = 'jp-mod-dirty';

export class DrawIODocumentWidget extends DocumentWidget<DrawIOWidget> {
  constructor(options: DrawIODocumentWidget.IOptions<DrawIOWidget>) {
    super(options);
    // Adding the buttons to the widget toolbar
    // Modify containers style: line ~92700
    // modulated.js, line: 84246
    // actions: modulated.js line: ~93000
    // actions: modulated.js line: ~111000

    this._commands = options.commands;
    this._menubar = new MainMenu(this._commands);

    this._menubar.clearMenus();

    //TODO:
    // Add toolbar actions to change the default style of arrows and conections.
    this._menuView = new JupyterLabMenu({ commands: this._commands });
    this._menuView.menu.title.caption = 'View (Space+Drag to Scroll)';
    this._menuView.menu.title.iconClass = 'geSprite geSprite-formatpanel';
    this._menubar.addMenu(this._menuView.menu, { rank: 1 });

    this._menuZoom = new JupyterLabMenu({ commands: this._commands });
    //TODO: Change label to a view percentage
    this._menuZoom.menu.title.label = 'Zoom';
    this._menuZoom.menu.title.caption = 'Zoom (Alt+Mousewheel)';
    this._menubar.addMenu(this._menuZoom.menu, { rank: 2 });

    this._menuInsert = new JupyterLabMenu({ commands: this._commands });
    this._menuInsert.menu.title.caption = 'Insert';
    this._menuInsert.menu.title.iconClass = 'geSprite geSprite-plus';
    this._menubar.addMenu(this._menuInsert.menu, { rank: 2 });

    this.context.ready.then(async value => {
      await this.content.ready.promise;

      this._onTitleChanged();
      this._addToolbarItems();
      this.content.setContent(this.context.model.toString());
      this._handleDirtyStateNew();

      //Adding command to the command registry
      this._addCommands();

      this.context.pathChanged.connect(this._onTitleChanged, this);
      //this.context.model.contentChanged.connect(this._onContentChanged, this);
      this.context.model.stateChanged.connect(
        this._onModelStateChangedNew,
        this
      );
      this.content.graphChanged.connect(this._saveToContext, this);
    });
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    Signal.clearData(this);
    super.dispose();
  }

  /**
   * A promise that resolves when the csv viewer is ready.
   */
  get ready(): Promise<void> {
    return this.content.ready.promise;
  }

  public getSVG(): string {
    return ''; //this.mx.mxUtils.getXml(this._editor.editor.graph.getSvg());
  }

  public execute(action: string): void {
    this.content.getAction(action).funct();
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  /* private _onContentChanged(): void {
    this.content.setContent(this.context.model.toString());
  } */

  private _saveToContext(emiter: DrawIOWidget, content: string): void {
    this.context.model.fromString(content);
  }

  private _onModelStateChangedNew(
    sender: DocumentRegistry.IModel,
    args: IChangedArgs<any>
  ): void {
    if (args.name === 'dirty') {
      this._handleDirtyStateNew();
    }
  }

  private _handleDirtyStateNew(): void {
    if (this.context.model.dirty) {
      this.title.className += ` ${DIRTY_CLASS}`;
    } else {
      this.title.className = this.title.className.replace(DIRTY_CLASS, '');
    }
  }

  private _addToolbarItems(): void {
    const actions = this.content.getActions();

    // Menu view
    this._menuView.addGroup([
      { command: 'drawio:command/formatPanel' },
      { command: 'drawio:command/outline' },
      { command: 'drawio:command/layers' }
    ]);

    // Menu Zoom
    this._menuZoom.addGroup([
      { command: 'drawio:command/resetView' },
      { command: 'drawio:command/fitWindow' },
      { command: 'drawio:command/fitPageWidth' },
      { command: 'drawio:command/fitPage' },
      { command: 'drawio:command/fitTwoPages' },
      { command: 'drawio:command/customZoom' }
    ]);

    // Menu insert
    this._menuInsert.addGroup([
      { command: 'drawio:command/insertLink' },
      { command: 'drawio:command/insertImage' }
    ]);

    this.toolbar.addItem('ViewDropdown', this._menubar);

    actions['zoomIn'].iconCls = 'geSprite geSprite-zoomin';
    this.toolbar.addItem('zoomIn', new DrawIOToolbarButton(actions['zoomIn']));
    actions['zoomOut'].iconCls = 'geSprite geSprite-zoomout';
    this.toolbar.addItem(
      'zoomOut',
      new DrawIOToolbarButton(actions['zoomOut'])
    );

    actions['undo'].iconCls = 'geSprite geSprite-undo';
    this.toolbar.addItem('undo', new DrawIOToolbarButton(actions['undo']));
    actions['redo'].iconCls = 'geSprite geSprite-redo';
    this.toolbar.addItem('redo', new DrawIOToolbarButton(actions['redo']));

    actions['delete'].iconCls = 'geSprite geSprite-delete';
    this.toolbar.addItem('delete', new DrawIOToolbarButton(actions['delete']));

    actions['toFront'].iconCls = 'geSprite geSprite-tofront';
    this.toolbar.addItem(
      'toFront',
      new DrawIOToolbarButton(actions['toFront'])
    );
    actions['toBack'].iconCls = 'geSprite geSprite-toback';
    this.toolbar.addItem('toBack', new DrawIOToolbarButton(actions['toBack']));

    actions['fillColor'].iconCls = 'geSprite geSprite-fillcolor';
    this.toolbar.addItem(
      'fillColor',
      new DrawIOToolbarButton(actions['fillColor'])
    );
    actions['strokeColor'].iconCls = 'geSprite geSprite-strokecolor';
    this.toolbar.addItem(
      'strokeColor',
      new DrawIOToolbarButton(actions['strokeColor'])
    );
    actions['shadow'].iconCls = 'geSprite geSprite-shadow';
    this.toolbar.addItem('shadow', new DrawIOToolbarButton(actions['shadow']));
  }

  private _addCommands(): void {
    const actions = this.content.getActions();

    console.debug(actions);

    // FILE MENU
    //Not Working: new, open, save, save as, import, export
    //Working: pageSetup, print
    const fileCommands = ['pageSetup', 'print'];
    fileCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,
        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
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
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'delete',
      'duplicate',
      'editData',
      'editTooltip',
      'editStyle',
      'edit',
      'editLink',
      'openLink',
      'selectVertices',
      'selectEdges',
      'selectAll',
      'selectNone',
      'lockUnlock'
    ];
    editCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,
        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
      });
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
      'formatPanel',
      'outline',
      'layers',
      'pageView',
      'pageScale',
      'scrollbars',
      'tooltips',
      'grid',
      'guides',
      'connectionArrows',
      'connectionPoints',
      'resetView',
      'zoomIn',
      'zoomOut'
    ];
    viewCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,
        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
      });
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
      'toFront',
      'toBack',
      'rotation',
      'turn',
      //'alignCellsLeft', 'alignCellsCenter', 'alignCellsRight', 'alignCellsTop', 'alignCellsMiddle', 'alignCellsBottom',
      'home',
      'exitGroup',
      'enterGroup',
      'expand',
      'collapse',
      'collapsible',
      'insertLink',
      'insertImage',
      'group',
      'ungroup',
      'removeFromGroup',
      'clearWaypoints',
      'autosize'
    ];
    arrangeCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,
        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
      });
    });

    //Direction
    this._commands.addCommand('drawio:command/flipH', {
      label: 'Left Align',
      caption: 'Left Align',
      execute: () => {
        this.content.graph.toggleCellStyles(
          this.content.mx.mxConstants.STYLE_FLIPH,
          false
        );
      }
    });
    this._commands.addCommand('drawio:command/flipV', {
      label: 'Left Align',
      caption: 'Left Align',
      execute: () => {
        this.content.graph.toggleCellStyles(
          this.content.mx.mxConstants.STYLE_FLIPV,
          false
        );
      }
    });

    //Align
    this._commands.addCommand('drawio:command/alignCellsLeft', {
      label: 'Left Align',
      caption: 'Left Align',
      execute: () => {
        if (this.content.graph.isEnabled()) {
          this.content.graph.alignCells(this.content.mx.mxConstants.ALIGN_LEFT);
        }
      }
    });
    this._commands.addCommand('drawio:command/alignCellsCenter', {
      label: 'Center',
      caption: 'Center',
      execute: () => {
        if (this.content.graph.isEnabled()) {
          this.content.graph.alignCells(
            this.content.mx.mxConstants.ALIGN_CENTER
          );
        }
      }
    });
    this._commands.addCommand('drawio:command/alignCellsRight', {
      label: 'Right Align',
      caption: 'Right Align',
      execute: () => {
        if (this.content.graph.isEnabled()) {
          this.content.graph.alignCells(
            this.content.mx.mxConstants.ALIGN_RIGHT
          );
        }
      }
    });
    this._commands.addCommand('drawio:command/alignCellsTop', {
      label: 'Top Align',
      caption: 'Top Align',
      execute: () => {
        if (this.content.graph.isEnabled()) {
          this.content.graph.alignCells(this.content.mx.mxConstants.ALIGN_TOP);
        }
      }
    });
    this._commands.addCommand('drawio:command/alignCellsMiddle', {
      label: 'Middle',
      caption: 'Middle',
      execute: () => {
        if (this.content.graph.isEnabled()) {
          this.content.graph.alignCells(
            this.content.mx.mxConstants.ALIGN_MIDDLE
          );
        }
      }
    });
    this._commands.addCommand('drawio:command/alignCellsBottom', {
      label: 'Bottom Align',
      caption: 'Bottom Align',
      execute: () => {
        if (this.content.graph.isEnabled()) {
          this.content.graph.alignCells(
            this.content.mx.mxConstants.ALIGN_BOTTOM
          );
        }
      }
    });

    //Distribute
    this._commands.addCommand('drawio:command/horizontal', {
      label: 'Horizontal',
      caption: 'Horizontal',
      execute: () => this.content.graph.distributeCells(true)
    });
    this._commands.addCommand('drawio:command/vertical', {
      label: 'Vertical',
      caption: 'Vertical',
      execute: () => this.content.graph.distributeCells(false)
    });

    //Layout
    this._commands.addCommand('drawio:command/horizontalFlow', {
      label: 'Horizontal Flow',
      caption: 'Horizontal Flow',
      execute: () => {
        const mxHierarchicalLayout = this.content.mx.mxHierarchicalLayout;
        const layout = new mxHierarchicalLayout(
          this.content.graph,
          this.content.mx.mxConstants.DIRECTION_WEST
        );

        this.content.editor.executeLayout(() => {
          const selectionCells = this.content.graph.getSelectionCells();
          layout.execute(
            this.content.graph.getDefaultParent(),
            selectionCells.length === 0 ? null : selectionCells
          );
        }, true);
      }
    });
    this._commands.addCommand('drawio:command/verticalFlow', {
      label: 'Vertical Flow',
      caption: 'Vertical Flow',
      execute: () => {
        const mxHierarchicalLayout = this.content.mx.mxHierarchicalLayout;
        const layout = new mxHierarchicalLayout(
          this.content.graph,
          this.content.mx.mxConstants.DIRECTION_NORTH
        );

        this.content.editor.executeLayout(() => {
          const selectionCells = this.content.graph.getSelectionCells();
          layout.execute(
            this.content.graph.getDefaultParent(),
            selectionCells.length === 0 ? null : selectionCells
          );
        }, true);
      }
    });

    const promptSpacing = this.content.mx.mxUtils.bind(
      this,
      (defaultValue: any, fn: any) => {
        const FilenameDialog = this.content.mx.FilenameDialog;
        const dlg = new FilenameDialog(
          this.content.editor,
          defaultValue,
          this.content.mx.mxResources.get('apply'),
          (newValue: any) => {
            fn(parseFloat(newValue));
          },
          this.content.mx.mxResources.get('spacing')
        );
        this.content.editor.showDialog(dlg.container, 300, 80, true, true);
        dlg.init();
      }
    );

    this._commands.addCommand('drawio:command/horizontalTree', {
      label: 'Horizontal Tree',
      caption: 'Horizontal Tree',
      execute: () => {
        let tmp = this.content.graph.getSelectionCell();
        let roots = null;

        if (
          tmp === null ||
          this.content.graph.getModel().getChildCount(tmp) === 0
        ) {
          if (this.content.graph.getModel().getEdgeCount(tmp) === 0) {
            roots = this.content.graph.findTreeRoots(
              this.content.graph.getDefaultParent()
            );
          }
        } else {
          roots = this.content.graph.findTreeRoots(tmp);
        }

        if (roots !== null && roots.length > 0) {
          tmp = roots[0];
        }

        if (tmp !== null) {
          const mxCompactTreeLayout = this.content.mx.mxCompactTreeLayout;
          const layout = new mxCompactTreeLayout(this.content.graph, true);
          layout.edgeRouting = false;
          layout.levelDistance = 30;

          promptSpacing(
            layout.levelDistance,
            this.content.mx.mxUtils.bind(this, (newValue: any) => {
              layout.levelDistance = newValue;

              this.content.editor.executeLayout(() => {
                layout.execute(this.content.graph.getDefaultParent(), tmp);
              }, true);
            })
          );
        }
      }
    });
    this._commands.addCommand('drawio:command/verticalTree', {
      label: 'Vertical Tree',
      caption: 'Vertical Tree',
      execute: () => {
        let tmp = this.content.graph.getSelectionCell();
        let roots = null;

        if (
          tmp === null ||
          this.content.graph.getModel().getChildCount(tmp) === 0
        ) {
          if (this.content.graph.getModel().getEdgeCount(tmp) === 0) {
            roots = this.content.graph.findTreeRoots(
              this.content.graph.getDefaultParent()
            );
          }
        } else {
          roots = this.content.graph.findTreeRoots(tmp);
        }

        if (roots !== null && roots.length > 0) {
          tmp = roots[0];
        }

        if (tmp !== null) {
          const mxCompactTreeLayout = this.content.mx.mxCompactTreeLayout;
          const layout = new mxCompactTreeLayout(this.content.graph, false);
          layout.edgeRouting = false;
          layout.levelDistance = 30;

          promptSpacing(
            layout.levelDistance,
            this.content.mx.mxUtils.bind(this, (newValue: any) => {
              layout.levelDistance = newValue;

              this.content.editor.executeLayout(() => {
                layout.execute(this.content.graph.getDefaultParent(), tmp);
              }, true);
            })
          );
        }
      }
    });
    this._commands.addCommand('drawio:command/radialTree', {
      label: 'Radial Tree',
      caption: 'Radial Tree',
      execute: () => {
        let tmp = this.content.graph.getSelectionCell();
        let roots = null;

        if (
          tmp === null ||
          this.content.graph.getModel().getChildCount(tmp) === 0
        ) {
          if (this.content.graph.getModel().getEdgeCount(tmp) === 0) {
            roots = this.content.graph.findTreeRoots(
              this.content.graph.getDefaultParent()
            );
          }
        } else {
          roots = this.content.graph.findTreeRoots(tmp);
        }

        if (roots !== null && roots.length > 0) {
          tmp = roots[0];
        }

        if (tmp !== null) {
          const mxRadialTreeLayout = this.content.mx.mxRadialTreeLayout;
          const layout = new mxRadialTreeLayout(this.content.graph, false);
          layout.levelDistance = 80;
          layout.autoRadius = true;

          promptSpacing(
            layout.levelDistance,
            this.content.mx.mxUtils.bind(this, (newValue: any) => {
              layout.levelDistance = newValue;

              this.content.editor.executeLayout(() => {
                layout.execute(this.content.graph.getDefaultParent(), tmp);

                if (!this.content.graph.isSelectionEmpty()) {
                  tmp = this.content.graph.getModel().getParent(tmp);

                  if (this.content.graph.getModel().isVertex(tmp)) {
                    this.content.graph.updateGroupBounds(
                      [tmp],
                      this.content.graph.gridSize * 2,
                      true
                    );
                  }
                }
              }, true);
            })
          );
        }
      }
    });
    this._commands.addCommand('drawio:command/organic', {
      label: 'Organic',
      caption: 'Organic',
      execute: () => {
        const mxFastOrganicLayout = this.content.mx.mxFastOrganicLayout;
        const layout = new mxFastOrganicLayout(this.content.graph);

        promptSpacing(
          layout.forceConstant,
          this.content.mx.mxUtils.bind(this, (newValue: any) => {
            layout.forceConstant = newValue;

            this.content.editor.executeLayout(() => {
              let tmp = this.content.graph.getSelectionCell();

              if (
                tmp === null ||
                this.content.graph.getModel().getChildCount(tmp) === 0
              ) {
                tmp = this.content.graph.getDefaultParent();
              }

              layout.execute(tmp);

              if (this.content.graph.getModel().isVertex(tmp)) {
                this.content.graph.updateGroupBounds(
                  [tmp],
                  this.content.graph.gridSize * 2,
                  true
                );
              }
            }, true);
          })
        );
      }
    });
    this._commands.addCommand('drawio:command/circle', {
      label: 'Circle',
      caption: 'Circle',
      execute: () => {
        const mxCircleLayout = this.content.mx.mxCircleLayout;
        const layout = new mxCircleLayout(this.content.graph);

        this.content.editor.executeLayout(() => {
          let tmp = this.content.graph.getSelectionCell();

          if (
            tmp === null ||
            this.content.graph.getModel().getChildCount(tmp) === 0
          ) {
            tmp = this.content.graph.getDefaultParent();
          }

          layout.execute(tmp);

          if (this.content.graph.getModel().isVertex(tmp)) {
            this.content.graph.updateGroupBounds(
              [tmp],
              this.content.graph.gridSize * 2,
              true
            );
          }
        }, true);
      }
    });

    // Extras MENU
    //Not Working:
    //Working:
    //  copyConnect, collapseExpand
    //  editDiagram
    const extrasCommands = ['copyConnect', 'collapseExpand', 'editDiagram'];
    extrasCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,

        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
      });
    });

    // Help MENU
    //Not Working: help
    //Working:
    //  about
    const helpCommands = ['about'];
    helpCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,
        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
      });
    });

    /**************************************************************************************
     *                                     Toolbar                                        *
     **************************************************************************************/
    //Working: fitWindow, fitPageWidth, fitPage, fitTwoPages, customZoom
    const toolbarCommands = [
      'fitWindow',
      'fitPageWidth',
      'fitPage',
      'fitTwoPages',
      'customZoom'
    ];
    toolbarCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,
        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
      });
    });

    /**************************************************************************************
     *                                     Other                                          *
     **************************************************************************************/
    const otherCommands = [
      'addWaypoint',
      'autosave',
      'backgroundColor',
      'bold',
      'borderColor',
      'clearDefaultStyle',
      'curved',
      'dashed',
      'deleteAll',
      'dotted',
      'fontColor',
      'formattedText',
      'gradientColor',
      'image',
      'italic',
      'link',
      'pasteHere',
      'preview',
      'removeWaypoint',
      'rounded',
      'setAsDefaultStyle',
      'sharp',
      'solid',
      'subscript',
      'superscript',
      'toggleRounded',
      'underline',
      'wordWrap'
    ];
    otherCommands.forEach(name => {
      const label = actions[name].shortcut
        ? actions[name].label + ' (' + actions[name].shortcut + ')'
        : actions[name].label;

      this._commands.addCommand('drawio:command/' + name, {
        label: label,
        caption: label,
        isToggleable: actions[name].toggleAction ? true : false,
        isVisible: () => actions[name].visible,
        isEnabled: () => actions[name].enabled,
        isToggled: () =>
          actions[name].toggleAction ? actions[name].isSelected() : false,
        execute: () => actions[name].funct()
      });
    });
  }

  private _commands: CommandRegistry;
  private _menubar: MainMenu;
  private _menuView: JupyterLabMenu;
  private _menuZoom: JupyterLabMenu;
  private _menuInsert: JupyterLabMenu;
}

export namespace DrawIODocumentWidget {
  export interface IOptions<T>
    extends DocumentWidget.IOptions<DrawIOWidget, DocumentRegistry.IModel> {
    commands: CommandRegistry;
  }
}
