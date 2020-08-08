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

import { Token, PromiseDelegate } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

import { IStatusBar } from '@jupyterlab/statusbar';

import { Contents } from '@jupyterlab/services';
import { PathExt } from '@jupyterlab/coreutils';

import '@deathbeds/jupyterlab-drawio-webpack';

import {
  ILayoutRestorer,
  JupyterLab,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import {
  WidgetTracker,
  IWidgetTracker,
  ICommandPalette,
} from '@jupyterlab/apputils';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { DrawioWidget, DrawioFactory, DEBUG } from './editor';

import * as IO from './io';
import { DrawioStatus } from './status';

/**
 * The name of the factory that creates text editor widgets.
 */
const TEXT_FACTORY = 'Drawio';
const BINARY_FACTORY = 'Drawio Image';
const JSON_FACTORY = 'Drawio Notebook';

interface IDrawioTracker extends IWidgetTracker<DrawioWidget> {}

export const IDrawioTracker = new Token<IDrawioTracker>('drawio/tracki');

/**
 * The editor tracker extension.
 */
const plugin: JupyterFrontEndPlugin<IDrawioTracker[]> = {
  activate,
  id: '@deathbeds/jupyterlab-drawio:plugin',
  requires: [
    IFileBrowserFactory,
    ILayoutRestorer,
    IMainMenu,
    ICommandPalette,
    ISettingRegistry,
  ],
  optional: [ILauncher, IStatusBar],
  provides: IDrawioTracker,
  autoStart: true,
};

export default plugin;

const defaultExporter = async (
  drawio: DrawioWidget,
  key: string,
  settings: any = null
) => {
  return await drawio.exportAs(key);
};

function activate(
  app: JupyterLab,
  browserFactory: IFileBrowserFactory,
  restorer: ILayoutRestorer,
  menu: IMainMenu,
  palette: ICommandPalette,
  settingsRegistry: ISettingRegistry,
  launcher: ILauncher | null,
  statusBar: IStatusBar | null
): IDrawioTracker[] {
  const { commands } = app;

  let statusItem: DrawioStatus | null = null;

  if (statusBar) {
    statusItem = new DrawioStatus({ menu });
    statusBar.registerStatusItem('@deathbeds/jupyterlab-drawio:status', {
      item: statusItem,
      align: 'right',
      rank: 3,
      isActive: () => isEnabled(),
    });
  }

  // add file types
  for (const format of IO.ALL_FORMATS) {
    app.docRegistry.addFileType({
      name: format.name,
      contentType: format.contentType || 'file',
      displayName: format.label,
      mimeTypes: [format.mimetype],
      extensions: [format.ext],
      icon: format.icon,
      fileFormat: format.format,
      ...(format.pattern ? { pattern: format.pattern } : {}),
    });
  }

  /**
   * Create a widget tracker and associated factory for this model type
   */
  function initTracker(
    modelName: string,
    name: string,
    namespace: string,
    fileTypes: IO.IDrawioFormat[],
    defaultFor: IO.IDrawioFormat[]
  ) {
    const factory = new DrawioFactory({
      modelName,
      name,
      fileTypes: fileTypes.map(({ name }) => name),
      defaultFor: defaultFor.map(({ name }) => name),
      getSettings: () => settings.composite,
    });
    const tracker = new WidgetTracker<DrawioWidget>({ namespace });

    // Handle state restoration.
    restorer
      .restore(tracker, {
        command: 'docmanager:open',
        args: (widget) => ({ path: widget.context.path, factory: name }),
        name: (widget) => widget.context.path,
      })
      .catch(console.warn);

    factory.widgetCreated.connect((sender, widget) => {
      statusItem && (statusItem.model.status = `Loading Diagram...`);

      // initialize icon
      widget.title.icon = IO.drawioIcon;

      // Notify the instance tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => tracker.save(widget));

      // capture clicks inside the frame
      widget.frameClicked.connect((widget) => {
        app.shell.activateById(widget.id);
        statusItem &&
          (statusItem.model.status = `Editing ${widget.context.path}`);
      });

      // complete initialization once context is ready;
      widget.context.ready
        .then(() => {
          if (widget.context.contentsModel == null) {
            console.warn('widget not ready');
            return;
          }
          const { mimetype } = widget.context.contentsModel;
          const icon = IO.EXPORT_MIME_MAP.get(mimetype)?.icon;
          if (icon != null) {
            widget.title.icon = icon;
          }
          statusItem &&
            (statusItem.model.status = `${widget.context.path} ready`);
        })
        .catch(console.warn);

      // add to tracker
      tracker.add(widget).catch(console.warn);
    });
    app.docRegistry.addWidgetFactory(factory);

    return tracker;
  }

  let settings: ISettingRegistry.ISettings;

  let settingsReady = new PromiseDelegate<void>();

  function updateSettings(widget: DrawioWidget) {
    widget.updateSettings();
  }

  function settingsChanged() {
    statusItem && (statusItem.model.status = `settings changed`);
    for (const tracker of [textTracker, binaryTracker]) {
      tracker.forEach(updateSettings);
    }
  }

  settingsRegistry
    .load(plugin.id)
    .then((loadedSettings) => {
      DEBUG && console.warn('settings loaded', loadedSettings.composite);
      settings = loadedSettings;
      settings.changed.connect(() => settingsChanged());
      settingsChanged();
      settingsReady.resolve(void 0);
    })
    .catch((err) => console.error(err));

  // create the trackers
  const textTracker = initTracker(
    'text',
    TEXT_FACTORY,
    'drawio-text',
    IO.ALL_TEXT_FORMATS,
    IO.DEFAULT_TEXT_FORMATS
  );

  const binaryTracker = initTracker(
    'base64',
    BINARY_FACTORY,
    'drawio-binary',
    IO.ALL_BINARY_FORMATS,
    IO.DEFAULT_BINARY_FORMATS
  );

  const jsonTracker = initTracker(
    'notebook',
    JSON_FACTORY,
    'drawio-notebook',
    IO.ALL_JSON_FORMATS,
    IO.DEFAULT_JSON_FORMATS
  );

  /**
   * Whether there is an active DrawIO editor.
   */
  function isEnabled(): boolean {
    try {
      const { currentWidget } = app.shell;
      if (currentWidget == null) {
        return false;
      }

      const tracked: (Widget | null)[] = [
        textTracker.currentWidget,
        binaryTracker.currentWidget,
        jsonTracker.currentWidget,
      ];

      return tracked.indexOf(currentWidget) >= 0;
    } catch (err) {
      console.warn(err);
    }

    return false;
  }

  // Function to create a new untitled diagram file, given
  // the current working directory.
  const createNewDIO = (cwd: string) => {
    statusItem && (statusItem.model.status = `Creating Diagram in ${cwd}...`);

    const result = commands
      .execute('docmanager:new-untitled', {
        path: cwd,
        type: 'file',
        ext: IO.XML_NATIVE.ext,
      })
      .then((model: Contents.IModel) => {
        statusItem && (statusItem.model.status = `Opening Diagram...`);
        return commands.execute('docmanager:open', {
          path: model.path,
          factory: TEXT_FACTORY,
        });
      });
    return result;
  };

  /**
   * Create commands for all of the known export formats.
   */
  IO.EXPORT_FORMATS.map((exportFormat) => {
    const { ext, key, format, label, mimetype, icon } = exportFormat;
    const save = exportFormat.save || String;
    const _exporter = async (cwd: string) => {
      let drawio = app.shell.currentWidget as DrawioWidget;
      let stem = PathExt.basename(drawio.context.path).replace(/\.dio$/, '');

      statusItem &&
        (statusItem.model.status = `Exporting Diagram ${stem} to ${label}...`);

      const rawContent = await (exportFormat.exporter || defaultExporter)(
        drawio,
        key,
        settings
      );

      statusItem && (statusItem.model.status = `${stem} ready, saving...`);

      let model: Contents.IModel = await commands.execute(
        'docmanager:new-untitled',
        {
          path: cwd,
          type: exportFormat.contentType || 'file',
          ext,
        }
      );

      const newPath = PathExt.join(cwd, `${stem}-${+new Date()}${ext}`);
      model = await app.serviceManager.contents.rename(model.path, newPath);

      if (rawContent != null) {
        await app.serviceManager.contents.save(model.path, {
          ...model,
          format,
          mimetype,
          content: save(rawContent),
        });
      }

      statusItem &&
        (statusItem.model.status = `${stem} ${label} saved as ${PathExt.basename(
          newPath
        )}, launching...`);

      // TODO: make this behavior configurable

      const factories = app.docRegistry
        .preferredWidgetFactories(model.path)
        .map((f) => f.name);

      if (factories.length) {
        await app.commands.execute('docmanager:open', {
          factory: factories[0],
          path: model.path,
        });
      }

      statusItem &&
        (statusItem.model.status = `${PathExt.basename(newPath)} launched`);
    };

    commands.addCommand(`drawio:export-${key}`, {
      label: `Export ${IO.XML_NATIVE.label} as ${label}`,
      icon,
      execute: () => {
        let cwd = browserFactory.defaultBrowser.model.path;
        return _exporter(cwd);
      },
      isEnabled,
    });

    palette.addItem({
      command: `drawio:export-${key}`,
      category: `${IO.XML_NATIVE.label} Export`,
    });
  });

  // Add a command for creating a new diagram file.
  commands.addCommand('drawio:create-new', {
    label: IO.XML_NATIVE.label,
    icon: IO.drawioIcon,
    caption: `Create a new ${IO.XML_NATIVE.name} file`,
    execute: () => {
      let cwd = browserFactory.defaultBrowser.model.path;
      return createNewDIO(cwd);
    },
  });

  // Add a launcher item if the launcher is available.
  if (launcher) {
    launcher.add({
      command: 'drawio:create-new',
      rank: 1,
      category: 'Other',
    });
  }

  if (menu) {
    // Add new text file creation to the file menu.
    menu.fileMenu.newMenu.addGroup([{ command: 'drawio:create-new' }], 40);
  }

  // this is very odd, and probably can't be reused. Use the manager pattern?
  return [textTracker, binaryTracker, jsonTracker];
}
