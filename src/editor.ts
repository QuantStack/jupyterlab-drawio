let w = window as any;

let web_path = "https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/examples/grapheditor/www/";

w.RESOURCES_BASE = web_path + 'resources/';
w.STENCIL_PATH = web_path + 'stencils/';
w.IMAGE_PATH = web_path + 'images/';
w.STYLE_PATH = web_path + 'styles/';
w.CSS_PATH = web_path + 'styles/';
w.OPEN_FORM = web_path +  'open.html';

// w.mxBasePath = "http://localhost:8000/src/mxgraph/javascript/src/";

w.mxLoadStylesheets = false;  // disable loading stylesheets
w.mxLoadResources = false;

import * as mx from './mxgraph/javascript/examples/grapheditor/www/modulated.js';

import {
    ABCWidgetFactory, DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IChangedArgs, PathExt
} from '@jupyterlab/coreutils';

import {
  Widget
} from '@phosphor/widgets';

import {
  Message
} from '@phosphor/messaging';

import { 
    PromiseDelegate
} from '@phosphor/coreutils';


import './mxgraph/javascript/src/css/common.css';
import './mxgraph/javascript/examples/grapheditor/www/styles/grapheditor.css';

import {
    grapheditor_txt, default_xml
} from './pack';

const DIRTY_CLASS = 'jp-mod-dirty';

// MIME Extension packgage.json: 
// "mimeExtension": "lib/mime"

export
class DrawioWidget extends Widget implements DocumentRegistry.IReadyWidget {

    constructor(context: DocumentRegistry.Context) {
        super();
        this.context = context;

        this._onTitleChanged();
        context.pathChanged.connect(this._onTitleChanged, this);

        this.context.ready.then(() => { this._onContextReady(); });
        this.context.ready.then(() => { this._handleDirtyState(); });

        // this.node.style.minWidth = '100%';
    }

    protected onAfterShow(msg: Message): void {
        this._loadEditor(this.node);
        this._onContentChanged();
    }

    private _onContextReady() : void {
        const contextModel = this.context.model;

        // Set the editor model value.
        this._onContentChanged();

        contextModel.contentChanged.connect(this._onContentChanged, this);
        contextModel.stateChanged.connect(this._onModelStateChanged, this);

        this._editor.sidebarContainer.style.width = '208px';
        var footer = document.getElementsByClassName('geFooterContainer');

        this._editor.refresh();

        if (footer.length)
        {
            this._editor.footerHeight = 0;
            for (let i = 0; i < footer.length; i++)
            {
                let f = footer[i] as HTMLElement;
                f.style.height = '0px';
                f.style.display = 'none';
            }
            this._editor.refresh();
        }

        this._ready.resolve(void 0);
    }

    private _loadEditor(node: HTMLElement, contents?: string): void {
        // Adds required resources (disables loading of fallback properties, this can only
        // be used if we know that all keys are defined in the language specific file)
        mx.mxResources.loadDefaultBundle = false;

        // Fixes possible asynchronous requests
        mx.mxResources.parse(grapheditor_txt);
        let oParser = new DOMParser();
        let oDOM = oParser.parseFromString(default_xml, "text/xml");
        let themes: any = new Object(null);
        themes[mx.Graph.prototype.defaultThemeName] = oDOM.documentElement;
        this._editor = new mx.EditorUi(new mx.Editor(false, themes), node);

        this._editor.editor.graph.model.addListener(mx.mxEvent.NOTIFY, (sender: any, evt: any) => {
            this._saveToContext();
        });

        return this._editor;
    }

    /**
     * Handle a change to the title.
     */
    private _onTitleChanged(): void {
        this.title.label = PathExt.basename(this.context.localPath);
    }

    private _onContentChanged() : void {
        if (this._editor === undefined)
        {
            return;
        }

        const oldValue = mx.mxUtils.getXml(this._editor.editor.getGraphXml());
        const newValue = this.context.model.toString();

        if (oldValue !== newValue && !this._editor.editor.graph.isEditing()) {
            if (newValue.length)
            {
                let xml = mx.mxUtils.parseXml(newValue);
                this._editor.editor.setGraphXml(xml.documentElement);
            }
        }
    }

    private _saveToContext() : void {
        if (this._editor.editor.graph.isEditing())
        {
            this._editor.editor.graph.stopEditing();
        }
        let xml = mx.mxUtils.getXml(this._editor.editor.getGraphXml());
        this.context.model.fromString(xml);
    }

    private _onModelStateChanged(sender: DocumentRegistry.IModel, args: IChangedArgs<any>): void {
        if (args.name === 'dirty') {
            this._handleDirtyState();
        }
    }

    private _handleDirtyState() : void {
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

    readonly context: DocumentRegistry.Context;
    private _editor : any;
    private _ready = new PromiseDelegate<void>();
}

/**
 * A widget factory for drawio.
 */
export
class DrawioFactory extends ABCWidgetFactory<DrawioWidget, DocumentRegistry.IModel> {
  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(context: DocumentRegistry.Context): DrawioWidget {
    return new DrawioWidget(context);
  }
}
