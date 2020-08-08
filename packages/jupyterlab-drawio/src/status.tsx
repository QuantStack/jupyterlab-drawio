// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import React from "react";

import { VDomRenderer, VDomModel } from "@jupyterlab/apputils";

import {
  interactiveItem,
  clickedItem,
  Popup,
  showPopup,
  TextItem,
} from "@jupyterlab/statusbar";

import { Menu } from "@lumino/widgets";

/**
 * A namespace for TabSpaceComponent statics.
 */
namespace DrawioStatusComponent {
  /**
   * The props for TabSpaceComponent.
   */
  export interface IProps {
    /**
     * A simple status
     */
    status: string;

    /**
     * A click handler for the TabSpace component. By default
     * opens a menu allowing the user to select tabs vs spaces.
     */
    handleClick: () => void;
  }
}

/**
 * A pure functional component for rendering the TabSpace status.
 */
function DrawioStatusComponent(
  props: DrawioStatusComponent.IProps
): React.ReactElement<DrawioStatusComponent.IProps> {
  if (!props.status?.length) {
    return <span></span>;
  }
  return (
    <TextItem
      onClick={props.handleClick}
      source={`drawio: ${props.status || "ready"}`}
      title={`TBD…`}
    />
  );
}

/**
 * A VDomRenderer for a tabs vs. spaces status item.
 */
export class DrawioStatus extends VDomRenderer<DrawioStatus.Model> {
  /**
   * Create a new tab/space status item.
   */
  constructor(options: DrawioStatus.IOptions) {
    super(new DrawioStatus.Model());
    this.addClass(interactiveItem);
  }

  /**
   * Render the TabSpace status item.
   */
  render(): React.ReactElement<DrawioStatusComponent.IProps> | null {
    if (this.model == null) {
      return null;
    } else {
      return (
        <DrawioStatusComponent
          handleClick={() => this._handleClick()}
          status={this.model.status}
        />
      );
    }
  }

  /**
   * Handle a click on the status item.
   */
  private _handleClick(): void {
    const menu = this._menu;
    if (this._popup) {
      this._popup.dispose();
    }

    menu.aboutToClose.connect(this._menuClosed, this);

    this._popup = showPopup({
      body: menu,
      anchor: this,
      align: "right",
    });
  }

  private _menuClosed(): void {
    this.removeClass(clickedItem);
  }

  private _menu: Menu;
  private _popup: Popup | null = null;
}

export namespace DrawioStatus {
  export class Model extends VDomModel {
    _status: string = "";

    get status() {
      return this._status;
    }

    set status(status) {
      if (this._status != status) {
        this._status = status;
        this.stateChanged.emit(void 0);
      }
    }
  }

  export interface IOptions {
    //
  }
}
