import { Contents } from '@jupyterlab/services';

import { LabIcon } from '@jupyterlab/ui-components';

import DRAWIO_ICON_SVG from '../style/img/drawio.svg';
import { DrawioWidget } from './editor';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { PageConfig } from '@jupyterlab/coreutils';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { NotebookModel } from '@jupyterlab/notebook';

export const DRAWIO_METADATA = '@deathbeds/jupyterlab-drawio';

export interface IDrawioFormat<T = string> {
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
    drawio: DrawioWidget,
    key: string,
    settings: ISettingRegistry.ISettings
  ) => Promise<T | null>;
}

const iconRegEx = /jp-icon-warn0/;

export const drawioIcon = new LabIcon({
  name: 'drawio:drawio',
  svgstr: DRAWIO_ICON_SVG,
});

export const drawioSvgIcon = new LabIcon({
  name: 'drawio:svg',
  svgstr: DRAWIO_ICON_SVG.replace(iconRegEx, 'jp-icon-contrast1'),
});

export const drawioPngIcon = new LabIcon({
  name: 'drawio:png',
  svgstr: DRAWIO_ICON_SVG.replace(iconRegEx, 'jp-icon-contrast0'),
});

export const drawioPdfIcon = new LabIcon({
  name: 'drawio:pdf',
  svgstr: DRAWIO_ICON_SVG.replace(iconRegEx, 'jp-icon-contrast2'),
});

export const drawioIpynbIcon = new LabIcon({
  name: 'drawio:ipynb',
  svgstr: DRAWIO_ICON_SVG.replace(iconRegEx, 'jp-icon-contrast3'),
});

const stripDataURI = (raw: string) => raw.split(',')[1];

const unbase64SVG = (raw: string) => atob(stripDataURI(raw));

export const XML_NATIVE: IDrawioFormat = {
  ext: '.dio',
  format: 'text',
  icon: drawioIcon,
  key: 'drawio',
  label: 'Diagram',
  mimetype: 'application/dio',
  name: 'dio',
};

export const XML_LEGACY: IDrawioFormat = {
  ext: '.drawio',
  format: 'text',
  icon: drawioIcon,
  key: 'dio',
  label: 'Diagram (mxgraph)',
  mimetype: 'application/mxgraph',
  name: 'dio-legacy',
};

export const SVG_PLAIN: IDrawioFormat = {
  ext: '.svg',
  format: 'text',
  icon: drawioSvgIcon,
  key: 'svg',
  label: 'SVG',
  mimetype: 'image/svg+xml',
  name: 'svg',
  save: unbase64SVG,
};

export const SVG_EDITABLE: IDrawioFormat = {
  ...SVG_PLAIN,
  ext: '.dio.svg',
  key: 'xmlsvg',
  label: 'SVG (Editable)',
  name: 'diosvg',
  pattern: '^.*.dio.svg$',
};

export const PNG_PLAIN: IDrawioFormat = {
  ext: '.png',
  format: 'base64',
  icon: drawioPngIcon,
  key: 'png',
  label: 'PNG',
  mimetype: 'image/png',
  name: 'png',
  save: stripDataURI,
};

export const PNG_EDITABLE: IDrawioFormat = {
  ...PNG_PLAIN,
  ext: '.dio.png',
  key: 'xmlpng',
  label: 'PNG (Editable)',
  name: 'diopng',
  pattern: '^.*.dio.png$',
};

export const IPYNB_EDITABLE: IDrawioFormat<any> = {
  ext: '.dio.ipynb',
  key: 'ipynb',
  format: 'json',
  icon: drawioIpynbIcon,
  label: 'Diagram Notebook',
  mimetype: 'application/x-ipynb+json',
  name: 'dionotebook',
  pattern: '.*.dio.ipynb$',
  contentType: 'notebook',
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

export const PDF_PLAIN: IDrawioFormat = {
  ext: '.pdf',
  format: 'base64',
  icon: drawioPdfIcon,
  key: 'pdf',
  label: 'PDF',
  mimetype: 'application/pdf',
  name: 'pdf',
  save: stripDataURI,
  exporter: async (widget, key, settings) => {
    let drawioExportUrl = './drawio-export-demo';
    try {
      drawioExportUrl = (settings.composite['drawioExportDemo'] as any)['url'];
    } catch (err) {
      console.warn(err);
    }
    if (drawioExportUrl.indexOf('./') !== 0) {
      console.error(`don't know how to handle non-relative URLs`);
      return null;
    }
    const currentFormat = widget.format;

    const xml = currentFormat?.toXML
      ? currentFormat.toXML(widget.context.model)
      : widget.context.model.toString();

    let url = `${PageConfig.getBaseUrl()}${drawioExportUrl.slice(2)}`;
    url += url.endsWith('/') ? '' : '/';
    const query = new URLSearchParams();
    query.append('xml', xml);
    query.append('format', 'pdf');
    query.append('base64', '1');

    const response = await fetch(`${url}?token=${PageConfig.getToken()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: query.toString(),
    });

    const text = await response.text();

    return `application/pdf;base64,${text}`;
  },
};

export const PDF_BRANDED = {
  ...PDF_PLAIN,
  ext: '.dio.pdf',
};

export const EXPORT_FORMATS = [
  PNG_EDITABLE,
  PNG_PLAIN,
  SVG_EDITABLE,
  SVG_PLAIN,
  PDF_BRANDED,
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

export const EXPORT_MIME_MAP = new Map<string, IDrawioFormat>([
  [PNG_EDITABLE.mimetype, PNG_EDITABLE],
  [SVG_EDITABLE.mimetype, SVG_EDITABLE],
  [PDF_PLAIN.mimetype, PDF_PLAIN],
  [PDF_BRANDED.mimetype, PDF_BRANDED],
  [IPYNB_EDITABLE.mimetype, IPYNB_EDITABLE],
]);
