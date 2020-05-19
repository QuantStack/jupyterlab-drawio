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
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
} from "@jupyterlab/docregistry";

import { PathExt } from "@jupyterlab/coreutils";

import { Message } from "@lumino/messaging";

import { PromiseDelegate } from "@lumino/coreutils";

import { URLExt, PageConfig } from "@jupyterlab/coreutils";

import { IFrame } from "@jupyterlab/apputils";

import "../style/index.css";

const STATIC = URLExt.join(PageConfig.getBaseUrl(), "static");

const DRAWIO_URL = URLExt.join(
  STATIC,
  "lab",
  "node_modules/jupyterlab-drawio/src/drawio/src/main/webapp/index.html"
);

const DEBUG = 1;

/**
 * Core URL params that are required to function properly
 */
const CORE_EMBED_PARAMS = {
  embed: 1,
  proto: "json",
  configure: 1,
};

/**
 * Default embed params, mostly to turn off third-party javascript
 */
const DEFAULT_EMBED_PARAMS = {
  gapi: 0, // google
  od: 0, // onedrive
  tr: 0, // trello
  gl: 0, // gitlab
  noExitBtn: 1,
};

const DEFAULT_CONFIG = {
  compressXml: false,
  exportPdf: false,
  remoteConvert: false,
  plantUml: false,
  debug: DEBUG,
  showStartScreen: false,
  override: true,
};

/**
 * Additional capabilities to allow to sandbox
 */
const SANDBOX_EXCEPTIONS: IFrame.SandboxExceptions[] = [
  "allow-forms",
  "allow-modals",
  "allow-orientation-lock",
  "allow-pointer-lock",
  "allow-popups",
  "allow-presentation",
  "allow-same-origin",
  "allow-scripts",
  "allow-top-navigation",
];

const DRAWIO_CLASS = "jp-Drawio";

const READY_CLASS = "jp-Drawio-ready";

export class DrawioWidget extends DocumentWidget<IFrame> {
  constructor(options: DocumentWidget.IOptions<IFrame>) {
    super({ ...options });
    this.addClass(DRAWIO_CLASS);

    this.context = options["context"];

    this._onTitleChanged();
    this.context.pathChanged.connect(this._onTitleChanged, this);

    this.context.ready.then(() => {
      this._onContextReady();
    });

    this.ready.then(() => {
      this.addClass(READY_CLASS);
    });
  }

  async neverCallThis() {
    await import("./_static");
  }

  handleMessageEvent(evt: MessageEvent) {
    const msg = JSON.parse(evt.data);
    if (this._frame == null || evt.source !== this._frame.contentWindow) {
      return;
    }

    DEBUG && console.warn("drawio message received", msg);

    switch (msg.event) {
      case "configure":
        this.configureDrawio();
        break;
      case "init":
        this._onContentChanged();
        break;
      case "load":
        this._ready.resolve(void 0);
        break;
      case "save":
        this._lastEmitted = msg.xml;
        this.context.model.fromString(msg.xml);
        this.context.save();
        break;
      case "autosave":
        this._lastEmitted = msg.xml;
        this.context.model.fromString(msg.xml);
        break;
      default:
        DEBUG && console.warn("unhandled message", msg.event, msg);
        break;
    }
  }

  /** TODO: schema/settings for https://desk.draw.io/support/solutions/articles/16000058316 */
  private configureDrawio() {
    const config = {
      ...DEFAULT_CONFIG,
      // TODO listen for theme changes?
      ui: this.drawioTheme(),
      version: `${+new Date()}`,
    };
    console.log("configuring drawio", config);
    this.postMessage({ action: "configure", config });
  }

  private postMessage(msg: any) {
    if (this._frame == null) {
      return;
    }
    this._frame.contentWindow.postMessage(JSON.stringify(msg), "*");
  }

  drawioTheme() {
    return document.querySelector('body[data-jp-theme-light="true"]')
      ? "kennedy"
      : "dark";
  }

  drawioUrl() {
    const query = new URLSearchParams();
    const params = {
      ...DEFAULT_EMBED_PARAMS,
      ...CORE_EMBED_PARAMS,
      ui: this.drawioTheme(),
    };
    for (const p in params) {
      query.append(p, (params as any)[p]);
    }
    return DRAWIO_URL + "?" + query.toString();
  }

  onAfterShow(msg: Message): void {
    const url = this.drawioUrl();
    if (this.content.url == url) {
      return;
    }
    this._frame = this.content.node.querySelector(
      "iframe"
    ) as HTMLIFrameElement;
    window.addEventListener("message", (evt) => this.handleMessageEvent(evt));
    this.content.url = url;
  }

  private _onContextReady(): void {
    const contextModel = this.context.model;

    // Set the editor model value.
    this._onContentChanged();

    contextModel.contentChanged.connect(this._onContentChanged, this);
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  private _onContentChanged(): void {
    const xml = this.context.model.toString();
    if (xml === this._lastEmitted) {
      return;
    }

    this.postMessage({
      action: "load",
      autosave: 1,
      modified: "unsavedChanges",
      xml,
      title: PathExt.basename(this.context.localPath),
    });
  }

  /**
   * A promise that resolves when drawio is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  public content: IFrame;
  public revealed: Promise<void>;
  readonly context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _frame: HTMLIFrameElement;
  private _lastEmitted: string;
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
    return new DrawioWidget({
      context,
      content: new IFrame({
        sandbox: SANDBOX_EXCEPTIONS,
      }),
    });
  }
}
