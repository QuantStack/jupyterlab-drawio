import { Layout, Widget } from '@lumino/widgets';

import { IIterator, /*ArrayIterator*/ } from '@lumino/algorithm';

//import { Signal, ISignal } from '@lumino/signaling';

import { Message, /*MessageLoop*/ } from '@lumino/messaging';

/* This is a typing-only import. If you use it directly, the mxgraph content
   will be included in the main JupyterLab js bundle.
*/
// @ts-ignore
import * as MXModuleType from './mxgraph/javascript/examples/grapheditor/www/modulated.js';

import './mxgraph/javascript/src/css/common.css';

import './mxgraph/javascript/examples/grapheditor/www/styles/grapheditor.css';

import { grapheditorTxt, defaultXml } from './pack';

/**
 * A DrawIO layout.
 */
export class DrawIOLayout extends Layout {

	/**
   * Dispose of the resources held by the widget.
   */
	 dispose(): void {
    this._editor.destroy();
    super.dispose();
  }

  /**
   * Init the gridstack layout
   */
  init(): void {
    super.init();
		this._loadEditor(this.parent!.node);
    this.parent!.node.appendChild(this._editor);
    // fake window resize event to resize bqplot
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * Handle `update-request` messages sent to the widget.
   */
  protected onUpdateRequest(msg: Message): void {
    this._editor.refresh();
  }

  /**
   * Handle `resize-request` messages sent to the widget.
   */
  protected onResize(msg: Message): void {
    this._editor.onParentResize();
  }

  /**
   * Handle `fit-request` messages sent to the widget.
   */
  protected onFitRequest(msg: Message): void {
    this._editor.onParentResize();
  }

	iter(): IIterator<Widget> {
		throw new Error('Method not implemented.');
	}

	removeWidget(widget: Widget): void {
		throw new Error('Method not implemented.');
	}

	setContent(content: string): void {
		const xml = this.mx.mxUtils.parseXml(content);
    this._editor.editor.setGraphXml(xml.documentElement);
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

    //this._addToolbarItems();

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
        //this._saveToContext();
      });

    return this._editor;
  }
	
	private _editor: any;
  protected mx: Private.MX;
}

/**
 * A namespace for module-level concerns like loading mxgraph
 */

namespace Private {
  export type MX = typeof MXModuleType;

  //let _mx: typeof MXModuleType;
  //let _mxLoading: PromiseDelegate<MX>;

  /**
   * Asynchronously load the mx bundle, or return it if already available
   */
  /* export async function ensureMx(): Promise<MX> {
    if (_mx) {
      return _mx;
    }

    if (_mxLoading) {
      return await _mxLoading.promise;
    }

    _mxLoading = new PromiseDelegate();
    /*eslint-disable */
    // @ts-ignore
    //_mx = await import('./mxgraph/javascript/examples/grapheditor/www/modulated.js');
    /*eslint-enable */

    /*_mxLoading.resolve(_mx);
    return _mx;
  } */
}