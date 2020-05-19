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

import { Contents } from "@jupyterlab/services";

import { ILauncher } from "@jupyterlab/launcher";

import { IMainMenu } from "@jupyterlab/mainmenu";

import { Token } from "@lumino/coreutils";
import { LabIcon } from "@jupyterlab/ui-components";
import { DrawioWidget, DrawioFactory } from "./editor";
import { PathExt } from "@jupyterlab/coreutils";

import DRAWIO_ICON_SVG from "!!file-loader!./drawio/src/main/webapp/images/drawlogo-color.svg";

const drawioIcon = new LabIcon({
  name: "drawio:drawio",
  svgstr: DRAWIO_ICON_SVG,
});

/**
 * The name of the factory that creates editor widgets.
 */
const FACTORY = "Drawio";

/**
 *  Supported formats include
 * html (old embed format),
 * html2 (new embed format),
 * svg (default),
 * xmlsvg (SVG with embeddded XML),
 * png and xmlpng (PNG with embedded XML).
 * The data parameter in the exportevent contains a valid data URI for the given export format.
 */

interface IExportFormat {
  key: string;
  ext: string;
  label: string;
  format: Contents.FileFormat;
  mimetype: string;
  transform?: (raw: string) => string;
}

const stripDataURI = (raw: string) => raw.split(",")[1];
const unbase64SVG = (raw: string) => atob(stripDataURI(raw));

const EXPORT_FORMATS: IExportFormat[] = [
  {
    key: "svg",
    label: "SVG",
    ext: ".svg",
    format: "text",
    mimetype: "image/svg+xml",
    transform: unbase64SVG,
  },
  {
    key: "xmlsvg",
    label: "SVG (Editable)",
    ext: ".svg",
    format: "text",
    mimetype: "image/svg+xml",
    transform: unbase64SVG,
  },
  {
    key: "html2",
    label: "HTML",
    ext: ".html",
    format: "text",
    mimetype: "text/html",
  },
  {
    key: "png",
    label: "PNG",
    ext: ".png",
    format: "base64",
    mimetype: "image/png",
    transform: stripDataURI,
  },
  {
    key: "xmlpng",
    label: "PNG (Editable)",
    ext: ".png",
    format: "base64",
    mimetype: "image/png",
    transform: stripDataURI,
  },
];

interface IDrawioTracker extends IWidgetTracker<DrawioWidget> {}

export const IDrawioTracker = new Token<IDrawioTracker>("drawio/tracki");

/**
 * The editor tracker extension.
 */
const plugin: JupyterFrontEndPlugin<IDrawioTracker> = {
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
): IDrawioTracker {
  const namespace = "drawio";
  const factory = new DrawioFactory({
    name: FACTORY,
    fileTypes: ["dio"],
    defaultFor: ["dio"],
  });
  const { commands } = app;
  const tracker = new WidgetTracker<DrawioWidget>({ namespace });

  /**
   * Whether there is an active DrawIO editor.
   */
  function isEnabled(): boolean {
    return (
      tracker.currentWidget !== null &&
      tracker.currentWidget === app.shell.currentWidget
    );
  }

  // Handle state restoration.
  restorer.restore(tracker, {
    command: "docmanager:open",
    args: (widget) => ({ path: widget.context.path, factory: FACTORY }),
    name: (widget) => widget.context.path,
  });

  factory.widgetCreated.connect((sender, widget) => {
    widget.title.icon = "jp-MaterialIcon jp-ImageIcon"; // TODO change

    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => {
      tracker.save(widget);
    });
    tracker.add(widget);
  });
  app.docRegistry.addWidgetFactory(factory);

  // register the filetype
  app.docRegistry.addFileType({
    name: "dio",
    displayName: "Diagram",
    mimeTypes: ["application/dio"],
    extensions: [".dio"],
    icon: drawioIcon,
    fileFormat: "text",
  });

  // Function to create a new untitled diagram file, given
  // the current working directory.
  const createNewDIO = (cwd: string) => {
    return commands
      .execute("docmanager:new-untitled", {
        path: cwd,
        type: "file",
        ext: ".dio",
      })
      .then((model: Contents.IModel) => {
        return commands.execute("docmanager:open", {
          path: model.path,
          factory: FACTORY,
        });
      });
  };

  EXPORT_FORMATS.map((exportFormat) => {
    const { ext, key, format, label, mimetype } = exportFormat;
    const transform = exportFormat.transform || String;
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
      let stem = PathExt.basename(drawio.context.path);
      model = await app.serviceManager.contents.rename(
        model.path,
        PathExt.join(cwd, `${stem}${ext}`)
      );

      const rawContent = await drawio.exportAs(key);

      await app.serviceManager.contents.save(model.path, {
        ...model,
        format,
        mimetype,
        content: transform(rawContent),
      });
    };

    commands.addCommand(`drawio:export-${key}`, {
      label: `Export diagram as ${label}`,
      execute: () => {
        let cwd = browserFactory.defaultBrowser.model.path;
        return _exporter(cwd);
      },
      isEnabled,
    });

    palette.addItem({
      command: `drawio:export-${key}`,
      category: "Diagram Export",
    });
  });

  // Add a command for creating a new diagram file.
  commands.addCommand("drawio:create-new", {
    label: "Diagram",
    icon: drawioIcon,
    caption: "Create a new diagram file",
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

  return tracker;
}
