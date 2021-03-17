import { ReactWidget, ToolbarButtonComponent } from '@jupyterlab/apputils';

import * as React from 'react';

/**
 * A toolbar widget to open Format Panel.
 */
export class DrawIOToolbarButton extends ReactWidget {
  constructor(action: any) {
    super();
    this._action = action;

    if (this._action.eventListeners) {
      this._action.addListener('stateChanged', (action: any) => this.update());
    }
  }

  render(): JSX.Element {
    const onClick = (): void => {
      this._action.funct();
    };

    const icon = this._action.iconCls || '';
    const label = this._action.iconCls ? '' : this._action.label || '';
    const shortcut = this._action.shortcut || '';
    const tooltip = label + ' (' + shortcut + ')';
    const enabled = this._action.enabled;

    return (
      <ToolbarButtonComponent
        onClick={onClick}
        actualOnClick={true}
        tooltip={tooltip}
        label={label}
        iconClass={icon}
        enabled={enabled}
      />
    );
  }

  private _action: any;
}
