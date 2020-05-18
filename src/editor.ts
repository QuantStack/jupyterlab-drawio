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
  ABCWidgetFactory, DocumentRegistry,  DocumentWidget,
} from '@jupyterlab/docregistry';

import {
  Toolbar
} from '@jupyterlab/apputils';

import {
  PathExt
} from '@jupyterlab/coreutils';

import {
  Message
} from '@lumino/messaging';

import {
  PromiseDelegate
} from '@lumino/coreutils';

import { URLExt, PageConfig } from "@jupyterlab/coreutils";

import { IFrame } from '@jupyterlab/apputils';

const DRAWIO_URL = URLExt.join(
  PageConfig.getBaseUrl(),
  "static/lab",
  "node_modules/jupyterlab-drawio/src/drawio/src/main/webapp/index.html"
);


/**
 * Core URL params that are required to function properly
 */
const CORE_EMBED_PARAMS = {
    embed: 1,
    proto: 'json',
    configure: 1
};

/**
 * Default embed params, mostly to turn off third-party javascript
 */
const DEFAULT_EMBED_PARAMS = {
    gapi: 0,    // google
    od: 0,      // onedrive
    trello: 0,  // trello
    noExitBtn: 1,
}

const DEFAULT_CONFIG = {
    compressXml: false,
    override: true,
    version: (+(new Date())).toString()
}

export
class DrawioWidget extends DocumentWidget<IFrame> {

    constructor(options: DocumentWidget.IOptions<IFrame>) {
        super({ ...options });
        this.context = options['context'];

        this._onTitleChanged();
        this.context.pathChanged.connect(this._onTitleChanged, this);

        this.context.ready.then(() => { this._onContextReady(); });
    }

    async neverCallThis() {
        await import('./_static');
    }

    protected async onMxLoaded(mx: any) {
        // this.mx = mx;
        this._onTitleChanged();
        this.context.pathChanged.connect(this._onTitleChanged, this);

        await this.context.ready;

        this._onContextReady();
        // this._handleDirtyStateNew();
    }

    handleMessageEvent(evt: MessageEvent) {
        const msg = JSON.parse(evt.data);
        if(this._frame == null || evt.source !== this._frame.contentWindow){
            return;
        }

        console.log(msg);

        switch(msg.event) {
            case 'configure':
                this.configureDrawio();
                break;
            case 'init':
                this._onContentChanged();
                break;
            case 'save':
                this._lastEmitted = msg.xml;
                this.context.model.fromString(msg.xml);
                this.context.save();
                break;
            case 'autosave':
                this._lastEmitted = msg.xml;
                this.context.model.fromString(msg.xml);
                break;
            default:
                console.log('unhandled message', msg.event, msg);
                break;
        }
    }

    /** TODO: schema/settings for https://desk.draw.io/support/solutions/articles/16000058316 */
    private configureDrawio() {
        const config = {
            ...DEFAULT_CONFIG,
            // TODO listen for theme changes?
            ui: document.querySelector('body[data-jp-theme-light="true"]') ? 'kennedy' : 'dark'
        };
        console.log('configuring drawio', config);
        this.postMessage({action: 'configure', config});
    }

    private postMessage(msg: any) {
        if(this._frame == null) {
            return;
        }
        this._frame.contentWindow.postMessage(JSON.stringify(msg), '*');
    }

    drawioUrl() {
        const query = new URLSearchParams();
        const params = {
            ...DEFAULT_EMBED_PARAMS,
            ...CORE_EMBED_PARAMS
        };
        for(const p in params) {
            query.append(p, (params as any)[p]);
        }
        return DRAWIO_URL + '?' + query.toString();
    }

    onAfterShow(msg: Message): void {
        this._frame = this.content.node.querySelector('iframe') as HTMLIFrameElement;
        window.addEventListener('message', (evt) => this.handleMessageEvent(evt));
        this.content.url = this.drawioUrl();
    }

    private _onContextReady() : void {
        const contextModel = this.context.model;

        // Set the editor model value.
        this._onContentChanged();

        contextModel.contentChanged.connect(this._onContentChanged, this);

        this._ready.resolve(void 0);
    }

    /**
     * Handle a change to the title.
     */
    private _onTitleChanged(): void {
        this.title.label = PathExt.basename(this.context.localPath);
    }

    private _onContentChanged() : void {
        const xml = this.context.model.toString();
        if(xml == null || !xml.trim() || xml === this._lastEmitted) {
            return;
        }

        this.postMessage({
            action: 'load',
            autosave: 1,
            modified: 'unsavedChanges',
            xml,
            title: PathExt.basename(this.context.localPath)
        });
    }

    /**
     * A promise that resolves when the csv viewer is ready.
     */
    get ready(): Promise<void> {
        return this._ready.promise;
    }

    public content: IFrame;
    public toolbar: Toolbar;
    public revealed: Promise<void>;
    readonly context: DocumentRegistry.Context;
    private _ready = new PromiseDelegate<void>();
    private _frame: HTMLIFrameElement;
    private _lastEmitted: string;
}

/**
 * A widget factory for drawio.
 */
export
class DrawioFactory extends ABCWidgetFactory<DrawioWidget, DocumentRegistry.IModel> {
    /**
    * Create a new widget given a context.
    */
    constructor(options: DocumentRegistry.IWidgetFactoryOptions){
        super(options);
    }

    protected createNewWidget(context: DocumentRegistry.Context): DrawioWidget {
        return new DrawioWidget({context, content: new IFrame({
            sandbox: [
                'allow-forms',
                'allow-modals',
                'allow-orientation-lock',
                'allow-pointer-lock',
                'allow-popups',
                'allow-presentation',
                'allow-same-origin',
                'allow-scripts',
                'allow-top-navigation'
            ]
        })});
    }
}
