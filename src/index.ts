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

import { Token } from "@lumino/coreutils";
import { Contents } from "@jupyterlab/services";
import { PathExt } from "@jupyterlab/coreutils";

import {
  ILayoutRestorer,
  JupyterLab,
  JupyterFrontEndPlugin,
} from "@jupyterlab/application";

import {
  WidgetTracker,
  IWidgetTracker,
  ICommandPalette,
} from "@jupyterlab/apputils";

import { IFileBrowserFactory } from "@jupyterlab/filebrowser";

import { ILauncher } from "@jupyterlab/launcher";

import { IMainMenu } from "@jupyterlab/mainmenu";

import { DrawioWidget, DrawioFactory } from "./editor";

import * as IO from "./io";

/**
 * The name of the factory that creates text editor widgets.
 */
const TEXT_FACTORY = "Drawio";
const BINARY_FACTORY = "Drawio Image";

interface IDrawioTracker extends IWidgetTracker<DrawioWidget> {}

export const IDrawioTracker = new Token<IDrawioTracker>("drawio/tracki");

/**
 * The editor tracker extension.
 */
const plugin: JupyterFrontEndPlugin<IDrawioTracker[]> = {
  activate,
  id: "@jupyterlab/drawio-extension:plugin",
  requires: [IFileBrowserFactory, ILayoutRestorer, IMainMenu, ICommandPalette],
  optional: [ILauncher],
  provides: IDrawioTracker,
  autoStart: true,
};

export default plugin;

function activate(
  app: JupyterLab,
  browserFactory: IFileBrowserFactory,
  restorer: ILayoutRestorer,
  menu: IMainMenu,
  palette: ICommandPalette,
  launcher: ILauncher | null
): IDrawioTracker[] {
  const { commands } = app;

  // add file types
  for (const format of IO.ALL_FORMATS) {
    app.docRegistry.addFileType({
      name: format.name,
      displayName: format.label,
      mimeTypes: [format.mimetype],
      extensions: [format.ext],
      icon: format.icon,
      fileFormat: format.format,
      ...(format.pattern ? { pattern: format.pattern } : {}),
    });
  }

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
    });
    const tracker = new WidgetTracker<DrawioWidget>({ namespace });

    // Handle state restoration.
    restorer.restore(tracker, {
      command: "docmanager:open",
      args: (widget) => ({ path: widget.context.path, factory: name }),
      name: (widget) => widget.context.path,
    });

    factory.widgetCreated.connect((sender, widget) => {
      widget.title.icon = IO.drawioIcon;

      // Notify the instance tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => {
        tracker.save(widget);
      });
      widget.context.ready.then(() => {
        const {mimetype} = widget.context.contentsModel;
        const icon = IO.EXPORT_MIME_MAP.get(mimetype)?.icon;
        if(icon != null) {
          widget.title.icon = icon;
        }
      });
      tracker.add(widget);
    });
    app.docRegistry.addWidgetFactory(factory);

    return tracker;
  }

  const textTracker = initTracker(
    "text",
    TEXT_FACTORY,
    "drawio-text",
    IO.ALL_TEXT_FORMATS,
    IO.DEFAULT_TEXT_FORMATS
  );

  const binaryTracker = initTracker(
    "base64",
    BINARY_FACTORY,
    "drawio-binary",
    IO.ALL_BINARY_FORMATS,
    IO.DEFAULT_BINARY_FORMATS
  );

  /**
   * Whether there is an active DrawIO editor.
   */
  function isEnabled(): boolean {
    return (
      (textTracker.currentWidget !== null &&
        textTracker.currentWidget === app.shell.currentWidget) ||
      (binaryTracker.currentWidget !== null &&
        binaryTracker.currentWidget === app.shell.currentWidget)
    );
  }

  // Function to create a new untitled diagram file, given
  // the current working directory.
  const createNewDIO = (cwd: string) => {
    return commands
      .execute("docmanager:new-untitled", {
        path: cwd,
        type: "file",
        ext: IO.XML_NATIVE.ext,
      })
      .then((model: Contents.IModel) => {
        return commands.execute("docmanager:open", {
          path: model.path,
          factory: TEXT_FACTORY,
        });
      });
  };

  IO.EXPORT_FORMATS.map((exportFormat) => {
    const { ext, key, format, label, mimetype } = exportFormat;
    const save = exportFormat.save || String;
    const _exporter = async (cwd: string) => {
      let model: Contents.IModel = await commands.execute(
        "docmanager:new-untitled",
        {
          path: cwd,
          type: "file",
          ext,
        }
      );
      let drawio = app.shell.currentWidget as DrawioWidget;
      let stem = PathExt.basename(drawio.context.path).replace(/\.dio$/, "");
      model = await app.serviceManager.contents.rename(
        model.path,
        PathExt.join(cwd, `${stem}${ext}`)
      );

      const rawContent = await drawio.exportAs(key);

      await app.serviceManager.contents.save(model.path, {
        ...model,
        format,
        mimetype,
        content: save(rawContent),
      });
    };

    commands.addCommand(`drawio:export-${key}`, {
      label: `Export ${IO.XML_NATIVE.label} as ${label}`,
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
  commands.addCommand("drawio:create-new", {
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
      command: "drawio:create-new",
      rank: 1,
      category: "Other",
    });
  }

  if (menu) {
    // Add new text file creation to the file menu.
    menu.fileMenu.newMenu.addGroup([{ command: "drawio:create-new" }], 40);
  }

  return [textTracker, binaryTracker];
}
