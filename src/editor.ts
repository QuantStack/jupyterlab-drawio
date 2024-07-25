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

import { MainMenu } from '@jupyterlab/mainmenu';

import { RankedMenu } from '@jupyterlab/ui-components';

import { IChangedArgs, PathExt } from '@jupyterlab/coreutils';

import { undoIcon, redoIcon } from '@jupyterlab/ui-components';

import { CommandRegistry } from '@lumino/commands';

import { Signal } from '@lumino/signaling';

import { DrawIOWidget } from './widget';

import { DrawIOToolbarButton } from './toolbar';

import {
  formatPanelIcon,
  plusIcon,
  zoominIcon,
  zoomoutIcon,
  deleteIcon,
  toFrontIcon,
  toBackIcon,
  fillColorIcon,
  strokeColorIcon,
  shadowIcon
} from './icons';

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
    this.toolbar.addClass('dio-toolbar');

    //TODO:
    // Add toolbar actions to change the default style of arrows and conections.
    this._menuView = new RankedMenu({ commands: this._commands });
    this._menuView.rootMenu.title.caption = 'View (Space+Drag to Scroll)';
    this._menuView.rootMenu.title.icon = formatPanelIcon;
    this._menubar.addMenu(this._menuView.rootMenu, true, { rank: 1 });

    this._menuZoom = new RankedMenu({ commands: this._commands });
    //TODO: Change label to a view percentage
    this._menuZoom.rootMenu.title.label = 'Zoom';
    this._menuZoom.rootMenu.title.caption = 'Zoom (Alt+Mousewheel)';
    this._menubar.addMenu(this._menuZoom.rootMenu, true, { rank: 2 });

    this._menuInsert = new RankedMenu({ commands: this._commands });
    this._menuInsert.rootMenu.title.caption = 'Insert';
    this._menuInsert.rootMenu.title.icon = plusIcon;
    this._menubar.addMenu(this._menuInsert.rootMenu, true, { rank: 2 });

    this.context.ready.then(async value => {
      await this.content.ready.promise;

      this._onDrawIOTitleChanged();
      this._addToolbarItems();
      this.content.setContent(this.context.model.toString());
      this._handleDirtyStateNew();

      this.context.pathChanged.connect(this._onDrawIOTitleChanged, this);
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

  public getAction(action: string): any {
    return this.content.getAction(action);
  }

  public execute(action: string): void {
    this.content.getAction(action).funct();
  }

  public toggleCellStyles(flip: string): void {
    this.content.toggleCellStyles(flip);
  }

  public alignCells(align: string): void {
    this.content.alignCells(align);
  }

  public distributeCells(horizontal: boolean): void {
    this.content.distributeCells(horizontal);
  }

  public layoutFlow(direction: string): void {
    this.content.layoutFlow(direction);
  }

  public horizontalTree(): void {
    this.content.horizontalTree();
  }

  public verticalTree(): void {
    this.content.verticalTree();
  }

  public radialTree(): void {
    this.content.radialTree();
  }

  public organic(): void {
    this.content.organic();
  }

  public circle(): void {
    this.content.circle();
  }

  /**
   * Handle a change to the title.
   * changed since the base class method renamed as onTitlechanged
   */

  private _onDrawIOTitleChanged(): void {
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

    actions['zoomIn'].icon = zoominIcon;
    actions['zoomIn'].tooltip = 'Zoom In (Ctrl+(Numpad)/Alt+Mousewheel)';
    this.toolbar.addItem('zoomIn', new DrawIOToolbarButton(actions['zoomIn']));

    actions['zoomOut'].icon = zoomoutIcon;
    actions['zoomOut'].tooltip = 'Zoom Out (Ctrl-(Numpad)/Alt+Mousewheel)';
    this.toolbar.addItem(
      'zoomOut',
      new DrawIOToolbarButton(actions['zoomOut'])
    );

    actions['undo'].icon = undoIcon;
    actions['fillColor'].tooltip = 'Undo (Ctrl+Z)';
    this.toolbar.addItem('undo', new DrawIOToolbarButton(actions['undo']));

    actions['redo'].icon = redoIcon;
    actions['redo'].tooltip = 'Redo (Ctrl+Shift+Z)';
    this.toolbar.addItem('redo', new DrawIOToolbarButton(actions['redo']));

    actions['delete'].icon = deleteIcon;
    actions['delete'].tooltip = 'Delete';
    this.toolbar.addItem('delete', new DrawIOToolbarButton(actions['delete']));

    actions['toFront'].icon = toFrontIcon;
    actions['toFront'].tooltip = 'To Front (Ctrl+Shift+F)';
    this.toolbar.addItem(
      'toFront',
      new DrawIOToolbarButton(actions['toFront'])
    );

    actions['toBack'].icon = toBackIcon;
    actions['toBack'].tooltip = 'To Back (Ctrl+Shift+B)';
    this.toolbar.addItem('toBack', new DrawIOToolbarButton(actions['toBack']));

    actions['fillColor'].icon = fillColorIcon;
    actions['fillColor'].tooltip = 'Fill Color';
    this.toolbar.addItem(
      'fillColor',
      new DrawIOToolbarButton(actions['fillColor'])
    );

    actions['strokeColor'].icon = strokeColorIcon;
    actions['strokeColor'].tooltip = 'Fill Stroke Color';
    this.toolbar.addItem(
      'strokeColor',
      new DrawIOToolbarButton(actions['strokeColor'])
    );

    actions['shadow'].icon = shadowIcon;
    actions['shadow'].tooltip = 'Shadow';
    this.toolbar.addItem('shadow', new DrawIOToolbarButton(actions['shadow']));
  }

  private _commands: CommandRegistry;
  private _menubar: MainMenu;
  private _menuView: RankedMenu;
  private _menuZoom: RankedMenu;
  private _menuInsert: RankedMenu;
}

export namespace DrawIODocumentWidget {
  export interface IOptions<T>
    extends DocumentWidget.IOptions<DrawIOWidget, DocumentRegistry.IModel> {
    commands: CommandRegistry;
  }
}
