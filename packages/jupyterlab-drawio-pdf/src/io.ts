import { PageConfig } from '@jupyterlab/coreutils';
import {
  IDiagramManager,
  DRAWIO_ICON_CLASS_RE,
  DRAWIO_ICON_SVG,
} from '@deathbeds/jupyterlab-drawio/lib/tokens';

import { stripDataURI } from '@deathbeds/jupyterlab-drawio/lib/utils';

import { LabIcon } from '@jupyterlab/ui-components';

export const drawioPdfIcon = new LabIcon({
  name: 'drawio:pdf',
  svgstr: DRAWIO_ICON_SVG.replace(DRAWIO_ICON_CLASS_RE, 'jp-icon-contrast2'),
});

export const PDF_PLAIN: IDiagramManager.IFormat = {
  ext: '.pdf',
  format: 'base64',
  factoryName: `Diagram (PDF)`,
  icon: drawioPdfIcon,
  key: 'pdf',
  label: 'PDF',
  mimetype: 'application/pdf',
  name: 'pdf',
  isExport: true,
  isBinary: true,
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
  factoryName: `Diagram (Editable PDF)`,
  key: 'pdf-editable',
  ext: '.dio.pdf',
};
