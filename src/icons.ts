import { LabIcon } from '@jupyterlab/ui-components';

// icon svg import statements
import formatPanel from '../style/icons/formatPanel.svg';
import plus from '../style/icons/plus.svg';
import zoomin from '../style/icons/zoomin.svg';
import zoomout from '../style/icons/zoomout.svg';
import del from '../style/icons/del.svg';
import tofront from '../style/icons/tofront.svg';
import toback from '../style/icons/toback.svg';
import fillColor from '../style/icons/fillColor.svg';
import strokeColor from '../style/icons/strokeColor.svg';
import shadow from '../style/icons/shadow.svg';

export const formatPanelIcon = new LabIcon({
  name: 'drawio:icon/formatPanel',
  svgstr: formatPanel
});

export const plusIcon = new LabIcon({
  name: 'drawio:icon/plus',
  svgstr: plus
});

export const zoominIcon = new LabIcon({
  name: 'drawio:icon/zoomin',
  svgstr: zoomin
});

export const zoomoutIcon = new LabIcon({
  name: 'drawio:icon/zoomout',
  svgstr: zoomout
});

export const deleteIcon = new LabIcon({
  name: 'drawio:icon/delete',
  svgstr: del
});

export const toFrontIcon = new LabIcon({
  name: 'drawio:icon/toFront',
  svgstr: tofront
});

export const toBackIcon = new LabIcon({
  name: 'drawio:icon/toBack',
  svgstr: toback
});

export const fillColorIcon = new LabIcon({
  name: 'drawio:icon/fillColor',
  svgstr: fillColor
});

export const strokeColorIcon = new LabIcon({
  name: 'drawio:icon/strokeColor',
  svgstr: strokeColor
});

export const shadowIcon = new LabIcon({
  name: 'drawio:icon/shadow',
  svgstr: shadow
});
