import {
  IWidgetTracker,
  WidgetTracker,
  ICommandPalette,
} from '@jupyterlab/apputils';
import { JupyterLab, ILayoutRestorer } from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { PathExt } from '@jupyterlab/coreutils';
import {
  IDiagramManager,
  TEXT_FACTORY,
  CommandIds,
  BINARY_FACTORY,
  JSON_FACTORY,
} from './tokens';
import { DiagramWidget, DiagramFactory } from './editor';
import { Contents } from '@jupyterlab/services';
import { DrawioStatus } from './status';
import * as IO from './io';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';
import { DRAWIO_URL } from '@deathbeds/jupyterlab-drawio-webpack';

console.warn('DRAWIO_URL', DRAWIO_URL);

const DEFAULT_EXPORTER = async (
  drawio: DiagramWidget,
  key: string,
  settings: any = null
) => {
  return await drawio.exportAs(key);
};

export class DiagramManager implements IDiagramManager {
  private _formats = new Map<string, IDiagramManager.IFormat>();
  private _trackers = new Map<string, IWidgetTracker<DiagramWidget>>();
  private _settings: ISettingRegistry.ISettings;
  private _palette: ICommandPalette;
  private _browserFactory: IFileBrowserFactory;
  private _restorer: ILayoutRestorer;
  private _app: JupyterLab;
  private _status: DrawioStatus.Model;
  private _mimeExport = new Map<string, IDiagramManager.IFormat>();

  constructor(options: DiagramManager.IOptions) {
    this._app = options.app;
    this._restorer = options.restorer;
    this._palette = options.palette;
    this._status = new DrawioStatus.Model();
    this._initCommands();
  }

  protected _initCommands() {
    // Add a command for creating a new diagram file.
    this._app.commands.addCommand(CommandIds.createNew, {
      label: IO.XML_NATIVE.label,
      icon: IO.drawioIcon,
      caption: `Create a new ${IO.XML_NATIVE.name} file`,
      execute: () => {
        let cwd = this._browserFactory.defaultBrowser.model.path;
        return this.createNew(cwd);
      },
    });
  }

  isExportable(mimetype: string) {
    return this.formatForType(mimetype) != null;
  }

  formatForType(mimetype: string) {
    for (const fmt of this._formats.values()) {
      if (fmt.mimetype === mimetype && fmt.isExport) {
        return fmt;
      }
    }
    return null;
  }

  get drawioURL() {
    return DRAWIO_URL;
  }

  get status() {
    return this._status;
  }

  set status(status) {
    this._status = status;
  }

  get settings() {
    return this._settings;
  }

  set settings(settings) {
    this._settings = settings;
    this._settings.changed.connect(this._onSettingsChanged, this);
  }

  protected updateWidgetSettings(widget: DiagramWidget) {
    widget.updateSettings();
  }

  // Function to create a new untitled diagram file, given
  // the current working directory.
  createNew(cwd: string) {
    this._status.status = `Creating Diagram in ${cwd}...`;

    const result = this._app.commands
      .execute('docmanager:new-untitled', {
        path: cwd,
        type: 'file',
        ext: IO.XML_NATIVE.ext,
      })
      .then((model: Contents.IModel) => {
        this._status.status = `Opening Diagram...`;
        return this._app.commands.execute('docmanager:open', {
          path: model.path,
          factory: TEXT_FACTORY,
        });
      });
    return result;
  }

  protected _onSettingsChanged() {
    this._status.status = `settings changed`;
    for (const tracker of this._trackers.values()) {
      tracker.forEach(this.updateWidgetSettings);
    }
  }

  addFormat(format: IDiagramManager.IFormat) {
    this._formats.set(format.key, format);
    this._app.docRegistry.addFileType({
      name: format.name,
      contentType: format.contentType || 'file',
      displayName: format.label,
      mimeTypes: [format.mimetype],
      extensions: [format.ext],
      icon: format.icon,
      fileFormat: format.format,
      ...(format.pattern ? { pattern: format.pattern } : {}),
    });

    if (format.isExport) {
      this._initExportCommands(format);
    }
  }

  protected _initExportCommands(exportFormat: IDiagramManager.IFormat) {
    const { ext, key, format, label, mimetype, icon } = exportFormat;
    const save = exportFormat.save || String;
    const _exporter = async (cwd: string) => {
      let drawio = this._app.shell.currentWidget as DiagramWidget;
      let stem = PathExt.basename(drawio.context.path).replace(/\.dio$/, '');

      this._status.status = `Exporting Diagram ${stem} to ${label}...`;

      const rawContent = await (exportFormat.exporter || DEFAULT_EXPORTER)(
        drawio,
        key,
        this._settings
      );

      this._status.status = `${stem} ready, saving...`;

      let model: Contents.IModel = await this._app.commands.execute(
        'docmanager:new-untitled',
        {
          path: cwd,
          type: exportFormat.contentType || 'file',
          ext,
        }
      );

      const newPath = PathExt.join(cwd, `${stem}-${+new Date()}${ext}`);
      model = await this._app.serviceManager.contents.rename(
        model.path,
        newPath
      );

      if (rawContent != null) {
        await this._app.serviceManager.contents.save(model.path, {
          ...model,
          format,
          mimetype,
          content: save(rawContent),
        });
      }

      this._status.status = `${stem} ${label} saved as ${PathExt.basename(
        newPath
      )}, launching...`;

      // TODO: make this behavior configurable

      const factories = this._app.docRegistry
        .preferredWidgetFactories(model.path)
        .map((f) => f.name);

      if (factories.length) {
        await this._app.commands.execute('docmanager:open', {
          factory: factories[0],
          path: model.path,
        });
      }

      this._status.status = `${PathExt.basename(newPath)} launched`;
    };

    this._app.commands.addCommand(`drawio:export-${key}`, {
      label: `Export ${IO.XML_NATIVE.label} as ${label}`,
      icon,
      execute: () => {
        let cwd = this._browserFactory.defaultBrowser.model.path;
        return _exporter(cwd);
      },
      isEnabled: () => this.activeWidget == null,
    });

    this._palette.addItem({
      command: `drawio:export-${key}`,
      category: `${IO.XML_NATIVE.label} Export`,
    });
  }

  get activeWidget() {
    const { currentWidget } = this._app.shell;
    for (const tracker of this._trackers.values()) {
      if (tracker.currentWidget === currentWidget) {
        return tracker.currentWidget;
      }
    }
    return null;
  }

  /**
   * Create a widget tracker and associated factory for this model type
   */
  initTracker(modelName: string, name: string, namespace: string) {
    let fileTypes: IDiagramManager.IFormat[] = [];
    let defaultFor: IDiagramManager.IFormat[] = [];

    for (const fmt of this._formats.values()) {
      switch (name) {
        case TEXT_FACTORY:
          if (fmt.isText) {
            fileTypes.push(fmt);
            if (fmt.isBinary) {
              defaultFor.push(fmt);
            }
          }
          break;
        case BINARY_FACTORY:
          if (fmt.isBinary) {
            fileTypes.push(fmt);
            if (fmt.isBinary) {
              defaultFor.push(fmt);
            }
          }
          break;
        case JSON_FACTORY:
          if (fmt.isJson) {
            fileTypes.push(fmt);
            if (fmt.isBinary) {
              defaultFor.push(fmt);
            }
          }
          break;
        default:
          console.warn('dunno', name, fmt);
          break;
      }
    }
    const factory = new DiagramFactory({
      modelName,
      name,
      fileTypes: fileTypes.map(({ name }) => name),
      defaultFor: defaultFor.map(({ name }) => name),
      getSettings: () => this._settings.composite,
      manager: this,
    });
    const tracker = new WidgetTracker<DiagramWidget>({ namespace });

    // Handle state restoration.
    this._restorer
      .restore(tracker, {
        command: 'docmanager:open',
        args: (widget) => ({ path: widget.context.path, factory: name }),
        name: (widget) => widget.context.path,
      })
      .catch(console.warn);

    factory.widgetCreated.connect((sender, widget) => {
      this._status.status = `Loading Diagram...`;

      // initialize icon
      widget.title.icon = IO.drawioIcon;

      // Notify the instance tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => tracker.save(widget));

      // capture clicks inside the frame
      widget.frameClicked.connect((widget) => {
        this._app.shell.activateById(widget.id);
        this._status.status = `Editing ${widget.context.path}`;
      });

      // complete initialization once context is ready;
      widget.context.ready
        .then(() => {
          if (widget.context.contentsModel == null) {
            console.warn('widget not ready');
            return;
          }
          const { mimetype } = widget.context.contentsModel;
          const icon = this._mimeExport.get(mimetype)?.icon;
          if (icon != null) {
            widget.title.icon = icon;
          }
          this._status.status = `${widget.context.path} ready`;
        })
        .catch(console.warn);

      // add to tracker
      tracker.add(widget).catch(console.warn);
    });
    this._app.docRegistry.addWidgetFactory(factory);

    this._trackers.set(name, tracker);

    return tracker;
  }
}

export namespace DiagramManager {
  export interface IOptions extends IDiagramManager.IOptions {
    app: JupyterLab;
    restorer: ILayoutRestorer;
    palette: ICommandPalette;
    browserFactory: IFileBrowserFactory;
  }
}
