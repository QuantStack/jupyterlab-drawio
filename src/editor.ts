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
import { PromiseDelegate, ReadonlyPartialJSONObject } from "@lumino/coreutils";
import { Message } from "@lumino/messaging";

import { PathExt, URLExt, PageConfig } from "@jupyterlab/coreutils";
import { IFrame } from "@jupyterlab/apputils";
import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget,
} from "@jupyterlab/docregistry";

import * as IO from "./io";

import "../style/index.css";

const STATIC = URLExt.join(PageConfig.getBaseUrl(), "static");

const DRAWIO_URL = URLExt.join(
  STATIC,
  "lab",
  "node_modules/jupyterlab-drawio/src/drawio/src/main/webapp/index.html"
);

const DEBUG = window.location.hash.indexOf("DRAWIO_DEBUG") > -1;

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
  stealth: 1, // just to be sure
  noExitBtn: 1, // looks/acts weird
};

const DEFAULT_CONFIG = {
  compressXml: false,  // bigger size, _maybe_ diffable
  debug: DEBUG,  // a lot going on
  showStartScreen: false, // looks weird
  override: true, // might help
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
      this._saveNeedsExport = IO.EXPORT_MIME_MAP.has(
        this.context.contentsModel.mimetype
      );
      this.addClass(READY_CLASS);
    });
  }

  updateSettings(settings: ReadonlyPartialJSONObject) {
    this._settings = settings;
    this.reloadFrame(true);
  }

  exportAs(format: string) {
    this._exportPromise = new PromiseDelegate();

    this.postMessage({ action: "export", format });

    return this._exportPromise.promise;
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
        if (this._saveNeedsExport) {
          this.saveWithExport(true);
          break;
        }
        this._lastEmitted = msg.xml;
        this.context.model.fromString(msg.xml);
        this.context.save();
        break;
      case "autosave":
        if (this._saveNeedsExport) {
          this.saveWithExport();
          break;
        }
        this._lastEmitted = msg.xml;
        this.context.model.fromString(msg.xml);
        break;
      case "export":
        if (this._exportPromise != null) {
          this._exportPromise.resolve(msg.data);
          this._exportPromise = null;
        }

        if (this._saveWithExportPromise != null) {
          this._saveWithExportPromise.resolve(msg.data);
          this._saveWithExportPromise = null;
        }
        break;
      default:
        DEBUG && console.warn("unhandled message", msg.event, msg);
        break;
    }
  }

  onAfterShow(msg: Message): void {
    if (this._frame == null) {
      this._frame = this.content.node.querySelector(
        "iframe"
      ) as HTMLIFrameElement;
      window.addEventListener("message", (evt) => this.handleMessageEvent(evt));
    }
    this.reloadFrame();
  }

  private saveWithExport(hardSave = false) {
    const { mimetype } = this.context.contentsModel;
    const format = IO.EXPORT_MIME_MAP.get(mimetype);
    if (format?.save == null) {
      console.error(`Unexpected save with export of ${mimetype}`);
      return;
    }
    this._saveWithExportPromise = new PromiseDelegate();
    this.postMessage({
      action: "export",
      format: format.key,
    });
    this._saveWithExportPromise.promise
      .then((raw) => {
        const stripped = format.save(raw);
        if (stripped === this._lastEmitted) {
          return;
        }
        this._lastEmitted = stripped;
        this.context.model.fromString(stripped);
        if (hardSave) {
          this.context.save();
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }

  private configureDrawio() {
    let userConfig = this._settings?.drawioConfig as ReadonlyPartialJSONObject;
    const config = {
      ...DEFAULT_CONFIG,
      ...(userConfig || {}),
      version: `${+new Date()}`,
    };
    DEBUG && console.warn("configuring drawio", config);
    this.postMessage({ action: "configure", config });
  }

  private postMessage(msg: any) {
    if (this._frame == null) {
      return;
    }
    this._frame.contentWindow.postMessage(JSON.stringify(msg), "*");
  }

  private reloadFrame(force: boolean = false) {
    const query = new URLSearchParams();
    const userUrlParams = this._settings
      ?.drawioUrlParams as ReadonlyPartialJSONObject;
    const params = {
      ...DEFAULT_EMBED_PARAMS,
      ui: document.querySelector('body[data-jp-theme-light="true"]')
        ? "kennedy"
        : "dark",
      ...(userUrlParams || {}),
      ...CORE_EMBED_PARAMS,
    };
    for (const p in params) {
      query.append(p, (params as any)[p]);
    }
    const url = DRAWIO_URL + "?" + query.toString();

    if (force || this.content.url !== url) {
      this.removeClass(READY_CLASS);
      this.content.url = url;
    }
  }

  private _onContextReady(): void {
    this.context.model.contentChanged.connect(this._onContentChanged, this);
    this._onContentChanged();
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  private _onContentChanged(): void {
    const { model, contentsModel } = this.context;
    let xml = model.toString();

    if (xml === this._lastEmitted) {
      return;
    }

    if (contentsModel.format === "base64") {
      xml = `data:${contentsModel.mimetype};base64,${xml}`;
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

  /**
   * this exists to trick webpack into copying ~1000 files into static
   * */
  protected async neverCallThis() {
    await import("./_static");
  }

  public content: IFrame;
  public revealed: Promise<void>;
  readonly context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _exportPromise: PromiseDelegate<string>;
  private _saveWithExportPromise: PromiseDelegate<string>;
  private _frame: HTMLIFrameElement;
  private _lastEmitted: string;
  private _saveNeedsExport: boolean;
  private _settings: ReadonlyPartialJSONObject;
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
    const content = new IFrame({
      sandbox: SANDBOX_EXCEPTIONS,
    });
    return new DrawioWidget({ context, content });
  }
}
