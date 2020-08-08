import { LabIcon } from '@jupyterlab/ui-components';

import DRAWIO_ICON_SVG from '../style/img/drawio.svg';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { NotebookModel } from '@jupyterlab/notebook';

import {
  DRAWIO_METADATA,
  IDiagramManager,
  DRAWIO_ICON_CLASS_RE,
} from './tokens';

import { stripDataURI, unbase64SVG } from './utils';

export const drawioIcon = new LabIcon({
  name: 'drawio:drawio',
  svgstr: DRAWIO_ICON_SVG,
});

export const drawioSvgIcon = new LabIcon({
  name: 'drawio:svg',
  svgstr: DRAWIO_ICON_SVG.replace(DRAWIO_ICON_CLASS_RE, 'jp-icon-contrast1'),
});

export const drawioPngIcon = new LabIcon({
  name: 'drawio:png',
  svgstr: DRAWIO_ICON_SVG.replace(DRAWIO_ICON_CLASS_RE, 'jp-icon-contrast0'),
});

export const drawioIpynbIcon = new LabIcon({
  name: 'drawio:ipynb',
  svgstr: DRAWIO_ICON_SVG.replace(DRAWIO_ICON_CLASS_RE, 'jp-icon-contrast3'),
});

export const XML_NATIVE: IDiagramManager.IFormat = {
  ext: '.dio',
  format: 'text',
  icon: drawioIcon,
  key: 'drawio',
  label: 'Diagram',
  mimetype: 'application/dio',
  name: 'dio',
  isExport: true,
  isEditable: true,
  isText: true,
  isDefault: true,
};

export const XML_LEGACY: IDiagramManager.IFormat = {
  ext: '.drawio',
  format: 'text',
  icon: drawioIcon,
  key: 'dio',
  label: 'Diagram (mxgraph)',
  mimetype: 'application/mxgraph',
  name: 'dio-legacy',
  isExport: true,
  isEditable: true,
  isText: true,
  isDefault: true,
};

export const SVG_PLAIN: IDiagramManager.IFormat = {
  ext: '.svg',
  format: 'text',
  icon: drawioSvgIcon,
  key: 'svg',
  label: 'SVG',
  mimetype: 'image/svg+xml',
  name: 'svg',
  save: unbase64SVG,
  isExport: true,
  isText: true,
};

export const SVG_EDITABLE: IDiagramManager.IFormat = {
  ...SVG_PLAIN,
  ext: '.dio.svg',
  key: 'xmlsvg',
  label: 'SVG (Editable)',
  name: 'diosvg',
  pattern: '^.*.dio.svg$',
  isEditable: true,
  isDefault: true,
};

export const PNG_PLAIN: IDiagramManager.IFormat = {
  ext: '.png',
  format: 'base64',
  icon: drawioPngIcon,
  key: 'png',
  label: 'PNG',
  mimetype: 'image/png',
  name: 'png',
  save: stripDataURI,
  isBinary: true,
  isExport: true,
};

export const PNG_EDITABLE: IDiagramManager.IFormat = {
  ...PNG_PLAIN,
  ext: '.dio.png',
  key: 'xmlpng',
  label: 'PNG (Editable)',
  name: 'diopng',
  pattern: '^.*.dio.png$',
  isEditable: true,
  isDefault: true,
};

export const IPYNB_EDITABLE: IDiagramManager.IFormat<any> = {
  ext: '.dio.ipynb',
  key: 'ipynb',
  format: 'json',
  icon: drawioIpynbIcon,
  label: 'Diagram Notebook',
  mimetype: 'application/x-ipynb+json',
  name: 'dionotebook',
  pattern: '.*.dio.ipynb$',
  contentType: 'notebook',
  isJson: true,
  isEditable: true,
  isExport: true,
  isDefault: true,
  save: (raw) => {
    return raw;
  },
  fromXML: (model: NotebookModel, xml) => {
    const meta = model.metadata.get(
      DRAWIO_METADATA
    ) as ReadonlyPartialJSONObject;
    model.metadata.set(DRAWIO_METADATA, { ...(meta || {}), xml });
  },
  toXML: (model: NotebookModel) => {
    const meta = model.metadata.get(
      DRAWIO_METADATA
    ) as ReadonlyPartialJSONObject;
    return meta?.xml ? `${meta.xml}` : '';
  },
  exporter: async (widget, key, settings) => {
    const xml = (widget.context.model as any).value.text;
    const newModel = new NotebookModel();
    newModel.metadata.set(DRAWIO_METADATA, { xml });
    return newModel.toJSON();
  },
};

export const EXPORT_FORMATS = [
  PNG_EDITABLE,
  PNG_PLAIN,
  SVG_EDITABLE,
  SVG_PLAIN,
  IPYNB_EDITABLE,
];

export const ALL_BINARY_FORMATS = [PNG_PLAIN, PNG_EDITABLE];

export const ALL_TEXT_FORMATS = [
  SVG_EDITABLE,
  SVG_PLAIN,
  XML_NATIVE,
  XML_LEGACY,
];

export const ALL_JSON_FORMATS = [IPYNB_EDITABLE];

export const DEFAULT_TEXT_FORMATS = [SVG_EDITABLE, XML_NATIVE, XML_LEGACY];
export const DEFAULT_BINARY_FORMATS = [PNG_EDITABLE];
export const DEFAULT_JSON_FORMATS = [IPYNB_EDITABLE];
export const ALL_FORMATS = [
  ...ALL_BINARY_FORMATS,
  ...ALL_TEXT_FORMATS,
  ...ALL_JSON_FORMATS,
];
