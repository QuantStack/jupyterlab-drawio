import { Token } from '@lumino/coreutils';
import { Contents } from '@jupyterlab/services';
import { LabIcon } from '@jupyterlab/ui-components';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { DocumentRegistry } from '@jupyterlab/docregistry';

import { NS, PLUGIN_ID } from '.';
import { DiagramWidget } from './editor';

import ICON_SVG from '../style/img/drawio.svg';
export const CMD_NS = 'drawio';

/**
 * The name of the factory that creates text editor widgets.
 */
export const TEXT_FACTORY = 'Diagram';
export const BINARY_FACTORY = 'Diagram Image';
export const JSON_FACTORY = 'Diagram Notebook';

export const DRAWIO_ICON_SVG = ICON_SVG;

export const DRAWIO_METADATA = NS;

export interface IDiagramManager {
  addFormat(format: IDiagramManager.IFormat): void;
  isExportable(mimetype: string): boolean;
  formatForType(mimetype: string): IDiagramManager.IFormat | null;
  activeWidget: DiagramWidget | null;
}

export const DRAWIO_ICON_CLASS_RE = /jp-icon-warn0/;

export const IDiagramManager = new Token<IDiagramManager>(PLUGIN_ID);

export namespace IDiagramManager {
  export interface IOptions {}
  export interface IFormat<T = string> {
    key: string;
    name: string;
    ext: string;
    label: string;
    icon: LabIcon;
    format: Contents.FileFormat;
    mimetype: string;
    pattern?: string;
    contentType?: Contents.ContentType;
    save?: (raw: string) => string;
    load?: (raw: string) => string;
    toXML?: (model: DocumentRegistry.IModel) => string;
    fromXML?: (model: DocumentRegistry.IModel, xml: string) => void;
    exporter?: (
      drawio: DiagramWidget,
      key: string,
      settings: ISettingRegistry.ISettings
    ) => Promise<T | null>;
    isExport?: boolean;
    isBinary?: boolean;
    isText?: boolean;
    isJson?: boolean;
    isEditable?: boolean;
    isDefault?: boolean;
  }
}

export namespace CommandIds {
  export const createNew = 'drawio:create-new';
}
