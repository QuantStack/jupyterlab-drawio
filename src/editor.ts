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

const w = window as any;

const webPath =
  'https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/examples/grapheditor/www/';

w.RESOURCES_BASE = webPath + 'resources/';
w.STENCIL_PATH = webPath + 'stencils/';
w.IMAGE_PATH = webPath + 'images/';
w.STYLE_PATH = webPath + 'styles/';
w.CSS_PATH = webPath + 'styles/';
w.OPEN_FORM = webPath + 'open.html';

// w.mxBasePath = "http://localhost:8000/src/mxgraph/javascript/src/";

//w.imageBasePath = 'http://localhost:8000/src/mxgraph/javascript/';
w.mxLoadStylesheets = false; // disable loading stylesheets
w.mxLoadResources = false;

/* This is a typing-only import. If you use it directly, the mxgraph content
   will be included in the main JupyterLab js bundle.
*/
// @ts-ignore
import * as MXModuleType from './mxgraph/javascript/examples/grapheditor/www/modulated.js';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget
} from '@jupyterlab/docregistry';

import { IChangedArgs, PathExt } from '@jupyterlab/coreutils';

import { Widget, MenuBar, Menu } from '@lumino/widgets';

import { Message } from '@lumino/messaging';

import { CommandRegistry } from '@lumino/commands';

import { PromiseDelegate } from '@lumino/coreutils';

import './mxgraph/javascript/src/css/common.css';
import './mxgraph/javascript/examples/grapheditor/www/styles/grapheditor.css';

import { grapheditorTxt, defaultXml } from './pack';

import {
  //ViewDropdown,
  DrawIOToolbarButton
} from './toolbar';

const DIRTY_CLASS = 'jp-mod-dirty';

export class DrawioWidget extends DocumentWidget<Widget> {
  constructor(options: DocumentWidget.IOptions<Widget>) {
    super(options);
    // Adding the buttons to the widget toolbar
    // Modify containers style: line ~92700
    // modulated.js, line: 84246
    // actions: modulated.js line: ~93000
    // actions: modulated.js line: ~111000
    void Private.ensureMx().then(mx => this.onMxLoaded(mx));

    this._commands = new CommandRegistry();
    this._menubar = new MenuBar();// new ViewDropdown(this._commands);

    this._menuView = new Menu({ commands: this._commands });
    this._menuView.title.caption = 'View (Space+Drag to Scroll)';
    this._menuView.title.iconClass = 'geSprite geSprite-formatpanel';
    this._menubar.addMenu(this._menuView);

    this._menuZoom = new Menu({ commands: this._commands });
    this._menuZoom.title.label = 'Zoom';
    this._menuZoom.title.caption = 'Zoom (Alt+Mousewheel)';
    this._menubar.addMenu(this._menuZoom);

    this._menuInsert = new Menu({ commands: this._commands });
    this._menuInsert.title.caption = 'Insert';
    this._menuInsert.title.iconClass = 'geSprite geSprite-plus';
    this._menubar.addMenu(this._menuInsert);
  }

  protected async onMxLoaded(mx: Private.MX) {
    this.mx = mx;
    this._onTitleChanged();
    this.context.pathChanged.connect(this._onTitleChanged, this);

    await this.context.ready;

    this._onContextReady();
    this._handleDirtyStateNew();
  }

  onAfterShow(msg: Message): void {
    Private.ensureMx().then(() => {
      this._loadEditor(this.content.node);
      const contextModel = this.context.model;
      const xml = this.mx.mxUtils.parseXml(contextModel.toString());
      this._editor.editor.setGraphXml(xml.documentElement);
    });
  }

  public getSVG(): string {
    return this.mx.mxUtils.getXml(this._editor.editor.graph.getSvg());
  }

  private _onContextReady(): void {
    const contextModel = this.context.model;

    const xml = this.mx.mxUtils.parseXml(contextModel.toString());
    this._editor.editor.setGraphXml(xml.documentElement);

    contextModel.contentChanged.connect(this._onContentChanged, this);
    contextModel.stateChanged.connect(this._onModelStateChangedNew, this);

    const footer = document.getElementsByClassName('geFooterContainer');
    this._editor.sidebarContainer.style.width = "208px";

    this._editor.refresh();

    if (footer.length) {
      this._editor.footerHeight = 0;
      for (let i = 0; i < footer.length; i++) {
        const f = footer[i] as HTMLElement;
        f.style.height = '0px';
        f.style.display = 'none';
      }
      this._editor.refresh();
    }

    this._ready.resolve(void 0);
  }

  private _loadEditor(node: HTMLElement, contents?: string): void {
    const { mx } = this;
    // Adds required resources (disables loading of fallback properties, this can only
    // be used if we know that all keys are defined in the language specific file)
    mx.mxResources.loadDefaultBundle = false;

    // Fixes possible asynchronous requests
    mx.mxResources.parse(grapheditorTxt);
    const oParser = new DOMParser();
    const oDOM = oParser.parseFromString(defaultXml, 'text/xml');
    const themes: any = new Object(null);
    themes[(mx.Graph as any).prototype.defaultThemeName] = oDOM.documentElement;
    // Workaround for TS2351: Cannot use 'new' with an expression whose type lacks a call or construct signature
    const _Editor: any = mx.Editor;
    this._editor = new mx.EditorUi(new _Editor(false, themes), node);

    this._addToolbarItems();

    //Dialog.prototype.closeImage

    //var elem: HTMLElement = this._editor.menubarContainer;
    //elem.parentNode.removeChild(elem);
    console.debug(this._editor);

    this._editor.editor.graph.model.addListener(
      mx.mxEvent.NOTIFY,
      (sender: any, evt: any) => {
        const changes: any[] = evt.properties.changes;
        for (let i=0; i<changes.length; i++) {
          if (changes[i].root) return;
        }
        this._saveToContext();
      });

    return this._editor;
  }

  private _addToolbarItems(): void {
    // ADD TOOLBAR BUTTONS
    if (!this._commands.hasCommand('drawio:toolbar/formatPanel')) {
      this._addCommands();
    }
    
    const actions = this._editor.actions.actions;
    this.toolbar.addItem('ViewDropdown', this._menubar);
    
    actions['zoomIn'].iconCls = "geSprite geSprite-zoomin";
    this.toolbar.addItem('zoomIn', new DrawIOToolbarButton(actions['zoomIn']));
    actions['zoomOut'].iconCls = "geSprite geSprite-zoomout";
    this.toolbar.addItem('zoomOut', new DrawIOToolbarButton(actions['zoomOut']));
    
    actions['undo'].iconCls = "geSprite geSprite-undo";
    this.toolbar.addItem('undo', new DrawIOToolbarButton(actions['undo']));
    actions['redo'].iconCls = "geSprite geSprite-redo";
    this.toolbar.addItem('redo', new DrawIOToolbarButton(actions['redo']));

    actions['delete'].iconCls = "geSprite geSprite-delete";
    this.toolbar.addItem('delete', new DrawIOToolbarButton(actions['delete']));
    
    actions['toFront'].iconCls = "geSprite geSprite-tofront";
    this.toolbar.addItem('toFront', new DrawIOToolbarButton(actions['toFront']));
    actions['toBack'].iconCls = "geSprite geSprite-toback";
    this.toolbar.addItem('toBack', new DrawIOToolbarButton(actions['toBack']));
    
    actions['fillColor'].iconCls = "geSprite geSprite-fillcolor";
    this.toolbar.addItem('fillColor', new DrawIOToolbarButton(actions['fillColor']));
    actions['strokeColor'].iconCls = "geSprite geSprite-strokecolor";
    this.toolbar.addItem('strokeColor', new DrawIOToolbarButton(actions['strokeColor']));
    actions['shadow'].iconCls = "geSprite geSprite-shadow";
    this.toolbar.addItem('shadow', new DrawIOToolbarButton(actions['shadow']));
  }

  private _addCommands(): void {
    const actions = this._editor.actions.actions;
    /**************************************************************************************
     *                                    _menuView                                       *
     **************************************************************************************/
    this._commands.addCommand('drawio:toolbar/formatPanel', {
      label: actions['formatPanel'].label + " (" + actions['formatPanel'].shortcut + ")",
      caption: actions['formatPanel'].label + " (" + actions['formatPanel'].shortcut + ")",
      isEnabled: () => actions['formatPanel'].enabled,
      isToggled: () => actions['formatPanel'].enabled,
      execute: () => actions['formatPanel'].funct()
    });
    this._menuView.addItem({ command: 'drawio:toolbar/formatPanel' });
    this._commands.addCommand('drawio:toolbar/outline', {
      label: actions['outline'].label,
      caption: actions['outline'].label + " (" + actions['outline'].shortcut + ")",
      isEnabled: () => actions['outline'].enabled,
      isToggled: () => actions['outline'].enabled,
      execute: () => actions['outline'].funct()
    });
    this._menuView.addItem({ command: 'drawio:toolbar/outline' });
    this._commands.addCommand('drawio:toolbar/layers', {
      label: actions['layers'].label,
      caption: actions['layers'].label + " (" + actions['layers'].shortcut + ")",
      isEnabled: () => actions['layers'].enabled,
      isToggled: () => actions['layers'].enabled,
      execute: () => actions['layers'].funct()
    });
    this._menuView.addItem({ command: 'drawio:toolbar/layers' });

    /**************************************************************************************
     *                                     _menuZoom                                      *
     **************************************************************************************/
    this._commands.addCommand('drawio:toolbar/resetView', {
      label: actions['resetView'].label,
      caption: actions['resetView'].label + " (" + actions['resetView'].shortcut + ")",
      isEnabled: () => actions['resetView'].enabled,
      isToggled: () => actions['resetView'].enabled,
      execute: () => actions['resetView'].funct()
    });
    this._menuZoom.addItem({ command: 'drawio:toolbar/resetView' });
    this._commands.addCommand('drawio:toolbar/fitWindow', {
      label: actions['fitWindow'].label,
      caption: actions['fitWindow'].label + " (" + actions['fitWindow'].shortcut + ")",
      isEnabled: () => actions['fitWindow'].enabled,
      isToggled: () => actions['fitWindow'].enabled,
      execute: () => actions['fitWindow'].funct()
    });
    this._menuZoom.addItem({ command: 'drawio:toolbar/fitWindow' });
    this._commands.addCommand('drawio:toolbar/fitPageWidth', {
      label: actions['fitPageWidth'].label,
      caption: actions['fitPageWidth'].label + " (" + actions['fitPageWidth'].shortcut + ")",
      isEnabled: () => actions['fitPageWidth'].enabled,
      isToggled: () => actions['fitPageWidth'].enabled,
      execute: () => actions['fitPageWidth'].funct()
    });
    this._menuZoom.addItem({ command: 'drawio:toolbar/fitPageWidth' });
    this._commands.addCommand('drawio:toolbar/fitPage', {
      label: actions['fitPage'].label,
      caption: actions['fitPage'].label + " (" + actions['fitPage'].shortcut + ")",
      isEnabled: () => actions['fitPage'].enabled,
      isToggled: () => actions['fitPage'].enabled,
      execute: () => actions['fitPage'].funct()
    });
    this._menuZoom.addItem({ command: 'drawio:toolbar/fitPage' });
    this._commands.addCommand('drawio:toolbar/fitTwoPages', {
      label: actions['fitTwoPages'].label,
      caption: actions['fitTwoPages'].label + " (" + actions['fitTwoPages'].shortcut + ")",
      isEnabled: () => actions['fitTwoPages'].enabled,
      isToggled: () => actions['fitTwoPages'].enabled,
      execute: () => actions['fitTwoPages'].funct()
    });
    this._menuZoom.addItem({ command: 'drawio:toolbar/fitTwoPages' });
    this._commands.addCommand('drawio:toolbar/customZoom', {
      label: actions['customZoom'].label,
      caption: actions['customZoom'].label + " (" + actions['customZoom'].shortcut + ")",
      isEnabled: () => actions['customZoom'].enabled,
      isToggled: () => actions['customZoom'].enabled,
      execute: () => actions['customZoom'].funct()
    });
    this._menuZoom.addItem({ command: 'drawio:toolbar/customZoom' });

    /**************************************************************************************
     *                                   _menuInsert                                      *
     **************************************************************************************/
    this._commands.addCommand('drawio:toolbar/insertLink', {
      label: actions['insertLink'].label,
      caption: actions['insertLink'].label + " (" + actions['insertLink'].shortcut + ")",
      isEnabled: () => actions['insertLink'].enabled,
      isToggled: () => actions['insertLink'].enabled,
      execute: () => actions['insertLink'].funct()
    });
    this._menuInsert.addItem({ command: 'drawio:toolbar/insertLink' });
    this._commands.addCommand('drawio:toolbar/insertImage', {
      label: actions['insertImage'].label,
      caption: actions['insertImage'].label + " (" + actions['insertImage'].shortcut + ")",
      isEnabled: () => actions['insertImage'].enabled,
      isToggled: () => actions['insertImage'].enabled,
      execute: () => actions['insertImage'].funct()
    });
    this._menuInsert.addItem({ command: 'drawio:toolbar/insertImage' });
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  private _onContentChanged(): void {
    const { mx } = this;
    if (this._editor === undefined) {
      return;
    }

    const graph = this._editor.editor.getGraphXml();
    const oldValue = mx.mxUtils.getXml(graph);
    const newValue = this.context.model.toString();

    if (oldValue !== newValue && !this._editor.editor.graph.isEditing()) {
      const xml = mx.mxUtils.parseXml(newValue);
      this._editor.editor.setGraphXml(xml.documentElement);
    }
  }

  private _saveToContext(): void {
    if (this._editor.editor.graph.isEditing()) {
      this._editor.editor.graph.stopEditing();
    }

    const graph = this._editor.editor.getGraphXml();
    const xml = this.mx.mxUtils.getXml(graph);
    this.context.model.fromString(xml);
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

  /**
   * A promise that resolves when the csv viewer is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /******************************************************************
  *                            MENUBAR                              *
  ******************************************************************/
  // FILE MENU
  //Not Working: new, open, save, save as, import, export
  //Working: Page setup, Print
  public getAction(name: string): any {
    return this._editor.actions.actions[name];
  }

  public pageSetup(): void {
    const action = this._editor.actions.actions.pageSetup;
    action.funct();
  }

  public print(): void {
    const action = this._editor.actions.actions.print;
    action.funct();
  }
  // END FILE MENU
  
  // FILE MENU
  //Not Working: 
  //Working:
  //  Undo, redo,
  //  cut, copy, Paste, Delete
  //  Duplicate
  //  Edit data, edit tooltip, Edit style
  //  Edit
  //  Edit link, open link
  //  Select vertices, select edges, select all, select node
  //  lock/unlock
  public undo(): void {
    const action = this._editor.actions.actions.undo;
    action.funct();
    //action.label; Undo
    //tooltip: Undo (Ctrl+Z)
    //action.iconCls; sprite-undo geSprite geSprite-undo
  }

  public redo(): void {
    const action = this._editor.actions.actions.redo;
    action.funct();
    //action.label; Redo
    //tooltip: Redo (Ctrl+Shift+Z)
    //action.iconCls; sprite-redo geSprite geSprite-redo
  }

  public cut(): void {
    const action = this._editor.actions.actions.cut;
    action.funct();
    //action.label; Cut
    //tooltip: Cut (Ctrl+X)
    //action.iconCls; sprite-cut geSprite geSprite-cut
  }

  public copy(): void {
    const action = this._editor.actions.actions.copy;
    action.funct();
    //action.label; Copy
    //tooltip: Copy (Ctrl+C)
    //action.iconCls; sprite-copy geSprite geSprite-copy
  }

  public paste(): void {
    const action = this._editor.actions.actions.paste;
    action.funct();
    //action.label; Paste
    //tooltip: Paste (Ctrl+V)
    //action.iconCls; sprite-paste geSprite geSprite-paste
  }

  public delete(): void {
    const action = this._editor.actions.actions.delete;
    action.funct();
    //action.label; Delete
    //tooltip: Delete
    //action.iconCls; geSprite geSprite-delete
  }

  public duplicate(): void {
    const action = this._editor.actions.actions.duplicate;
    action.funct();
    //action.label; Duplicate
    //tooltip: Duplicate (Ctrl+D)
  }

  public editData(): void {
    const action = this._editor.actions.actions.editData;
    action.funct();
    //action.label; Edit Data...
    //tooltip: Edit Data... (Ctrl+M)
  }

  public editTooltip(): void {
    const action = this._editor.actions.actions.editTooltip;
    action.funct();
    //action.label; Edit Tooltip...
    //tooltip: Edit Tooltip...
  }

  public editStyle(): void {
    const action = this._editor.actions.actions.editStyle;
    action.funct();
    //action.label; Edit Style...
    //tooltip: Edit Style... (Ctrl+E)
  }

  public edit(): void {
    const action = this._editor.actions.actions.edit;
    action.funct();
    //action.label; Edit
    //tooltip: Edit (F2/Enter)
  }


  public editDiagram(): void {
    const action = this._editor.actions.actions.editDiagram;
    action.funct();
    //action.iconCls;
  }



  public pageScale(): void {
    const action = this._editor.actions.actions.pageScale;
    action.funct();
    //action.iconCls;
  }

  public about(): void {
    const action = this._editor.actions.actions.about;
    action.funct();
    //action.iconCls;
  }

  public connectionArrows(): void {
    const action = this._editor.actions.actions.connectionArrows;
    action.funct();
    //action.label; Connection arrows
    //tooltip: Connection arrows (Alt+Shift+A)
  }

  public connectionPoints(): void {
    const action = this._editor.actions.actions.connectionPoints;
    action.funct();
    //action.label; Connection points
    //tooltip: Connection points (Alt+Shift+P)
  }

  /******************************************************************
  *                            TOOLBAR                              *
  ******************************************************************/
  // VIEW Dropbown
  //action.label; View (Space+Drag to Scroll)
  //action.iconCls; geSprite geSprite-formatpanel
  public formatPanel(): void {
    const action = this._editor.actions.actions.formatPanel;
    action.funct();
    //action.label; Format Panel (Ctrl+Shift+P)
  }

  public outline(): void {
    const action = this._editor.actions.actions.outline;
    action.funct();
    //action.label; Outline (Ctrl+Shift+O)
  }

  public layers(): void {
    const action = this._editor.actions.actions.layers;
    action.funct();
    //action.label; Layers (Ctrl+Shift+L)
  }
  // END VIEW Dropbown

  // ZOOM Dropbown
  //action.label; Zoom (Alt+Mousewheel)
  //action.iconCls; 100%
  public resetView(): void {
    const action = this._editor.actions.actions.resetView;
    action.funct();
    //action.label; Reset View (Ctrl+H)
  }

  public fitWindow(): void {
    const action = this._editor.actions.actions.fitWindow;
    action.funct();
    //action.label; Fit Window (Ctrl+Shift+H)
  }

  public fitPageWidth(): void {
    const action = this._editor.actions.actions.fitPageWidth;
    action.funct();
    //action.label; Page Width
  }

  public fitPage(): void {
    const action = this._editor.actions.actions.fitPage;
    action.funct();
    //action.label; One Page (Ctrl+J)
  }

  public fitTwoPages(): void {
    const action = this._editor.actions.actions.fitTwoPages;
    action.funct();
    //action.label; Two Pages (Ctrl+Shift+J)
  }

  public customZoom(): void {
    const action = this._editor.actions.actions.customZoom;
    action.funct();
    //action.label; Custom... (Ctrl+O)
  }
  // END ZOOM Dropbown

  public zoomIn(): void {
    const action = this._editor.actions.actions.zoomIn;
    action.funct();
    //action.label; Zoom In (Ctrl + (Numpad) / Alt+Mousewheel)
    //action.iconCls; geSprite geSprite-zoomin
  }

  public zoomOut(): void {
    const action = this._editor.actions.actions.zoomOut;
    action.funct();
    //action.label; Zoom Out (Ctrl - (Numpad) / Alt+Mousewheel)
    //action.iconCls; geSprite geSprite-zoomout
  }

  // In Menu section: undo, redo, delete

  

  public toFront(): void {
    const action = this._editor.actions.actions.toFront;
    action.funct();
    //action.label; To Front (Ctrl+Shift+F)
    //action.iconCls; geSprite geSprite-tofront
  }

  public toBack(): void {
    const action = this._editor.actions.actions.toBack;
    action.funct();
    //action.label; To Back (Ctrl+Shift+B)
    //action.iconCls; geSprite geSprite-toback
  }

  public fillColor(): void {
    const action = this._editor.actions.actions.fillColor;
    action.funct();
    //action.label; Fill Color...
    //action.iconCls; geSprite geSprite-fillcolor
  }

  public strokeColor(): void {
    const action = this._editor.actions.actions.strokeColor;
    action.funct();
    //action.label; Line Color...
    //action.iconCls; geSprite geSprite-strokecolor
  }

  public shadow(): void {
    const action = this._editor.actions.actions.shadow;
    action.funct();
    //action.label; Shadow
    //action.iconCls; geSprite geSprite-shadow
  }

  // CONNECTION Dropbown
  //action.label; Connection
  //action.iconCls; geSprite geSprite-connection
  
    // mxResources.get('connection')

  // END CONNECTION Dropbown

  // WAYPOINTS Dropbown
  //action.label; Waypoints
  //action.iconCls; geSprite geSprite-orthogonal

    // mxResources.get('pattern')
  
  // END WAYPOINTS Dropbown

  // INSERT Dropbown
  //action.label; Insert
  //action.iconCls; geSprite geSprite-plus
  public insertLink(): void {
    const action = this._editor.actions.actions.insertLink;
    action.funct();
    //action.label; Insert Link...
  }

  public insertImage(): void {
    const action = this._editor.actions.actions.insertImage;
    action.funct();
    //action.label; Insert Image...
  }
  // END INSERT Dropbown

  private _editor: any;
  private _commands: CommandRegistry;
  private _menubar: MenuBar;
  private _menuView: Menu;
  private _menuZoom: Menu;
  private _menuInsert: Menu;
  private _ready = new PromiseDelegate<void>();
  protected mx: Private.MX;
}

/**
 * A widget factory for drawio.
 */
export class DrawioFactory extends ABCWidgetFactory<
  DrawioWidget,
  DocumentRegistry.IModel
> {
  /**
   * Create a new widget given a context.
   */
  constructor(options: DocumentRegistry.IWidgetFactoryOptions) {
    super(options);
  }

  protected createNewWidget(context: DocumentRegistry.Context): DrawioWidget {
    return new DrawioWidget({ context, content: new Widget() });
  }
}

/**
 * A namespace for module-level concerns like loading mxgraph
 */

namespace Private {
  export type MX = typeof MXModuleType;

  let _mx: typeof MXModuleType;
  let _mxLoading: PromiseDelegate<MX>;

  /**
   * Asynchronously load the mx bundle, or return it if already available
   */
  export async function ensureMx(): Promise<MX> {
    if (_mx) {
      return _mx;
    }

    if (_mxLoading) {
      return await _mxLoading.promise;
    }

    _mxLoading = new PromiseDelegate();
    /*eslint-disable */
    // @ts-ignore
    _mx = await import('./mxgraph/javascript/examples/grapheditor/www/modulated.js');
    /*eslint-enable */

    _mxLoading.resolve(_mx);
    return _mx;
  }
}
