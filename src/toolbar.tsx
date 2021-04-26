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
    return (
      <ToolbarButtonComponent
        label={this._action.label}
        tooltip={this._action.tooltip}
        icon={this._action.icon}
        enabled={this._action.enabled}
        actualOnClick={true}
        onClick={this._action.funct}
      />
    );
  }

  private _action: any;
}
