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
import { Signal } from "@lumino/signaling";

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

/**
 * The path on the server to base application HTML, to be served in an iframe
 */
const DRAWIO_URL = URLExt.join(
  STATIC,
  "lab",
  "node_modules/jupyterlab-drawio/drawio/src/main/webapp/index.html"
);

/**
 * Escape hatch for runtime debugging.
 */
export const DEBUG = window.location.hash.indexOf("DRAWIO_DEBUG") > -1;

/**
 * Core URL params that are required to function properly
 */
const CORE_EMBED_PARAMS = {
  embed: 1,
  proto: "json",
  configure: 1,
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

/**
 * A document for using offline drawio in an iframe
 */
export class DrawioWidget extends DocumentWidget<IFrame> {
  constructor(options: DrawioWidget.IOptions) {
    super({ ...options });
    this.getSettings = options.getSettings;
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
    });
  }

  /**
   * Handle receiving settings from the extension
   */
  updateSettings() {
    this.maybeReloadFrame(true);
  }

  /**
   * Get a an export string in one of the supported formats.
   */
  exportAs(format: string): Promise<string> {
    this._exportPromise = new PromiseDelegate();

    this.postMessage({ action: "export", format });

    return this._exportPromise.promise;
  }

  /**
   * Handle messages from the iframe over the drawio embed protocol
   */
  handleMessageEvent(evt: MessageEvent) {
    const msg = JSON.parse(evt.data);
    if (
      this._frame?.contentWindow == null ||
      evt.source !== this._frame.contentWindow
    ) {
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
        this._initialLoad = true;
        this.addClass(READY_CLASS);
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

  /**
   * Install the message listener, the first time, and potentially reload the frame
   */
  onAfterShow(msg: Message): void {
    if (this._frame?.contentWindow == null) {
      this._frame = this.content.node.querySelector(
        "iframe"
      ) as HTMLIFrameElement;
      window.addEventListener("message", (evt) => this.handleMessageEvent(evt));
      this.revealed.then(() => {
        DEBUG && console.warn("drawio revealed");
        this.maybeReloadFrame();
      });
    }
    this.maybeReloadFrame();
  }

  /**
   * Handle round-tripping to formats that require an export
   */
  private saveWithExport(hardSave: boolean = false) {
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

  /**
   * Prepare and post the message for configuring the drawio application
   */
  private configureDrawio() {
    let settingsConfig = this.getSettings()
      ?.drawioConfig as ReadonlyPartialJSONObject;
    const config = {
      ...(settingsConfig || {}),
      version: `${+new Date()}`,
    };
    DEBUG && console.warn("configuring drawio", config);
    this.postMessage({ action: "configure", config });
  }

  /**
   * Post to the iframe, if available. Should be buffered?
   */
  private postMessage(msg: any) {
    if (this._frame?.contentWindow == null) {
      return false;
    }
    this._frame.contentWindow.postMessage(JSON.stringify(msg), "*");
    return true;
  }

  /**
   * Determine the URL for the iframe src, reload if changed
   */
  private maybeReloadFrame(force: boolean = false) {
    if (this.isHidden || !this.isVisible || !this.isRevealed) {
      return;
    }
    const query = new URLSearchParams();
    const settingsUrlParams = this.getSettings()
      ?.drawioUrlParams as ReadonlyPartialJSONObject;
    const params = {
      ...(settingsUrlParams || {}),
      ...CORE_EMBED_PARAMS,
    };
    for (const p in params) {
      query.append(p, (params as any)[p]);
    }
    const url = DRAWIO_URL + "?" + query.toString();

    if (force || this.content.url !== url) {
      DEBUG && console.warn("configuring iframe", params);
      this.removeClass(READY_CLASS);
      this.content.url = url;
      this._initialLoad = false;
      this._frame.onload = () => {
        this._frame.contentDocument.body.onclick = () => {
          DEBUG && console.warn("click");
          this._frameClicked.emit(void 0);
        };
      };
    }
  }

  private _onContextReady(): void {
    this.context.model.contentChanged.connect(this._onContentChanged, this);
    this._onContentChanged();
    this.onAfterShow(null);
  }

  /**
   * Handle a change to the title.
   */
  private _onTitleChanged(): void {
    this.title.label = PathExt.basename(this.context.localPath);
  }

  /**
   * Handle a change to the raw document
   */
  private _onContentChanged(): void {
    if (!this._frame?.contentWindow) {
      return;
    }
    const { model, contentsModel } = this.context;
    let xml = model.toString();

    if (xml === this._lastEmitted) {
      return;
    }

    if (contentsModel.format === "base64") {
      xml = `data:${contentsModel.mimetype};base64,${xml}`;
    }

    if (!this._initialLoad) {
      this.postMessage({
        action: "load",
        autosave: 1,
        noSaveBtn: 1,
        noExitBtn: 1,
        xml,
      });
    } else {
      this.postMessage({
        action: "merge",
        xml,
      });
    }
  }

  /**
   * A promise that resolves when drawio is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  get frameClicked() {
    return this._frameClicked;
  }

  /**
   * Trick webpack into copying ~1000 files into the app's static folder
   * */
  protected async neverCallThis() {
    await import("./_static");
  }

  public content: IFrame;
  public revealed: Promise<void>;
  readonly context: DocumentRegistry.Context;
  protected getSettings: ISettingsGetter;
  private _initialLoad = false;
  private _ready = new PromiseDelegate<void>();
  private _exportPromise: PromiseDelegate<string>;
  private _saveWithExportPromise: PromiseDelegate<string>;
  private _frame: HTMLIFrameElement;
  private _lastEmitted: string;
  private _saveNeedsExport: boolean;
  private _frameClicked = new Signal<DrawioWidget, void>(this);
}

export interface ISettingsGetter {
  (): ReadonlyPartialJSONObject;
}

export namespace DrawioWidget {
  export interface IOptions extends DocumentWidget.IOptions<IFrame> {
    getSettings: ISettingsGetter;
  }
}

/**
 * A widget factory for a drawio diagram.
 */
export class DrawioFactory extends ABCWidgetFactory<
  DrawioWidget,
  DocumentRegistry.IModel
> {
  protected getSettings: ISettingsGetter;
  /**
   * Create a new widget given a context.
   */
  constructor(options: DrawioFactory.IOptions) {
    super(options);
    this.getSettings = options.getSettings;
  }

  protected createNewWidget(context: DocumentRegistry.Context): DrawioWidget {
    const content = new IFrame({
      sandbox: SANDBOX_EXCEPTIONS,
    });
    return new DrawioWidget({
      context,
      content,
      getSettings: this.getSettings,
    });
  }
}

export namespace DrawioFactory {
  export interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
    getSettings: () => ReadonlyPartialJSONObject;
  }
}
