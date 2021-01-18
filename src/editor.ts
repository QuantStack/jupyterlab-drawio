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

import { Toolbar } from '@jupyterlab/apputils';

import { IChangedArgs, PathExt } from '@jupyterlab/coreutils';

import { Widget } from '@lumino/widgets';

import { Message } from '@lumino/messaging';

import { PromiseDelegate } from '@lumino/coreutils';

import './mxgraph/javascript/src/css/common.css';
import './mxgraph/javascript/examples/grapheditor/www/styles/grapheditor.css';

import { grapheditorTxt, defaultXml } from './pack';

const DIRTY_CLASS = 'jp-mod-dirty';

export class DrawioWidget extends DocumentWidget<Widget> {
  constructor(options: DocumentWidget.IOptions<Widget>) {
    super({ ...options });
    this.context = options['context'];
    void Private.ensureMx().then(mx => this.onMxLoaded(mx));
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
      this._loadEditor(this.node);
      this._onContentChanged();
    });
  }

  public getSVG(): string {
    return this.mx.mxUtils.getXml(this._editor.editor.graph.getSvg());
  }

  private _onContextReady(): void {
    const contextModel = this.context.model;

    // Set the editor model value.
    this._onContentChanged();

    contextModel.contentChanged.connect(this._onContentChanged, this);
    contextModel.stateChanged.connect(this._onModelStateChangedNew, this);

    this._editor.sidebarContainer.style.width = '208px';
    const footer = document.getElementsByClassName('geFooterContainer');

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

    this._editor.editor.graph.model.addListener(
      mx.mxEvent.NOTIFY,
      (sender: any, evt: any) => {
        this._saveToContext();
      }
    );

    return this._editor;
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

    const oldValue = mx.mxUtils.getXml(this._editor.editor.getGraphXml());
    const newValue = this.context.model.toString();

    if (oldValue !== newValue && !this._editor.editor.graph.isEditing()) {
      if (newValue.length) {
        const xml = mx.mxUtils.parseXml(newValue);
        this._editor.editor.setGraphXml(xml.documentElement);
      }
    }
  }

  private _saveToContext(): void {
    if (this._editor.editor.graph.isEditing()) {
      this._editor.editor.graph.stopEditing();
    }
    const xml = this.mx.mxUtils.getXml(this._editor.editor.getGraphXml());
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

  public content: Widget;
  public toolbar: Toolbar;
  public revealed: Promise<void>;
  readonly context: DocumentRegistry.Context;
  private _editor: any;
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
