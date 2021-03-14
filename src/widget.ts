import { Widget } from '@lumino/widgets';

import { Signal, ISignal } from '@lumino/signaling';

import { PromiseDelegate } from '@lumino/coreutils';

/*
	This is a typing-only import. If you use it directly, the mxgraph content
  will be included in the main JupyterLab js bundle.
*/
// @ts-ignore
import * as MX from './drawio/modulated.js';

import './drawio/css/common.css';

import './drawio/styles/grapheditor.css';

import { grapheditorTxt, defaultXml } from './pack';

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

/**
 * A DrawIO layout.
 */
export class DrawIOWidget extends Widget {
  /**
   * Construct a `GridStackLayout`.
   *
   * @param info - The `DashboardView` metadata.
   */
  constructor() {
    super();
    void Private.ensureMx().then(mx => this._loadDrawIO(mx));
    //this._loadDrawIO(MX);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    Signal.clearData(this);
    this._editor.destroy();
    super.dispose();
  }

  /**
   * A promise that resolves when the csv viewer is ready.
   */
  get ready(): PromiseDelegate<void> {
    return this._ready;
  }

  get graphChanged(): ISignal<this, string> {
    return this._graphChanged;
  }

  get mx(): any {
    return this._mx;
  }

  get editor(): any {
    return this._editor;
  }

  get graph(): any {
    return this._editor.editor.graph;
  }

  getAction(action: string): any {
    return this._editor.actions.actions[action];
  }

  getActions(): any {
    return this._editor.actions.actions;
  }

  setContent(newValue: string): void {
    if (this._editor === undefined) {
      return;
    }

    const oldValue = this._mx.mxUtils.getXml(this._editor.editor.getGraphXml());

    if (oldValue !== newValue && !this._editor.editor.graph.isEditing()) {
      if (newValue.length) {
        const xml = this._mx.mxUtils.parseXml(newValue);
        this._editor.editor.setGraphXml(xml.documentElement);
      }
    }
  }

  private _loadDrawIO(mx: Private.MX): void {
    this._mx = mx;

    // Adds required resources (disables loading of fallback properties, this can only
    // be used if we know that all keys are defined in the language specific file)
    this._mx.mxResources.loadDefaultBundle = false;

    // Fixes possible asynchronous requests
    this._mx.mxResources.parse(grapheditorTxt);
    const oParser = new DOMParser();
    const oDOM = oParser.parseFromString(defaultXml, 'text/xml');
    const themes: any = new Object(null);
    themes[(this._mx.Graph as any).prototype.defaultThemeName] =
      oDOM.documentElement;

    // Workaround for TS2351: Cannot use 'new' with an expression whose type lacks a call or construct signature
    const Editor: any = this._mx.Editor;
    this._editor = new this._mx.EditorUi(new Editor(false, themes), this.node);

    this._editor.sidebarContainer.style.width = '208px';
    this._editor.refresh();

    this._editor.editor.graph.model.addListener(
      this._mx.mxEvent.NOTIFY,
      (sender: any, evt: any) => {
        const changes: any[] = evt.properties.changes;
        for (let i = 0; i < changes.length; i++) {
          if (changes[i].root) {
            return;
          }
        }

        if (this._editor.editor.graph.isEditing()) {
          this._editor.editor.graph.stopEditing();
        }

        const graph = this._editor.editor.getGraphXml();
        const xml = this._mx.mxUtils.getXml(graph);
        this._graphChanged.emit(xml);
      }
    );

    this._ready.resolve(void 0);
  }

  private _editor: any;
  private _mx: Private.MX;
  private _ready = new PromiseDelegate<void>();
  private _graphChanged = new Signal<this, string>(this);
}

/**
 * A namespace for module-level concerns like loading mxgraph
 */

namespace Private {
  export type MX = typeof MX;

  let _mx: typeof MX;
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
    _mx = await import('./drawio/modulated.js');
    /*eslint-enable */

    _mxLoading.resolve(_mx);
    return _mx;
  }
}
