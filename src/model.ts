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

import { DocumentRegistry } from '@jupyterlab/docregistry';

import {
  ISharedDocument,
  YDocument,
  Delta,
  MapChange
} from '@jupyterlab/shared-models';

import { IChangedArgs } from '@jupyterlab/coreutils';

import { IModelDB, ModelDB } from '@jupyterlab/observables';

import { PartialJSONValue, ReadonlyPartialJSONValue } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import * as Y from 'yjs';

import { parse } from 'fast-xml-parser';

export class DrawIODocumentModel implements DocumentRegistry.IModel {
  /**
   * Construct a new DrawIODocumentModel.
   */
  constructor(languagePreference?: string, modelDB?: IModelDB) {
    this.modelDB = modelDB || new ModelDB();
  }

  get dirty(): boolean {
    return this._dirty;
  }
  set dirty(value: boolean) {
    this._dirty = value;
  }

  get readOnly(): boolean {
    return this._readOnly;
  }
  set readOnly(value: boolean) {
    this._readOnly = value;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get contentChanged(): ISignal<this, void> {
    return this._contentChanged;
  }

  get stateChanged(): ISignal<this, IChangedArgs<any, any, string>> {
    return this._stateChanged;
  }

  readonly defaultKernelName: string;

  readonly defaultKernelLanguage: string;

  readonly modelDB: IModelDB;

  readonly sharedModel: ISharedXMLFile = XMLFile.create();

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  toString(): string {
    // TODO: Return content from shared model
    console.info('DrawIODocumentModel.toString():', this.sharedModel.getSource());
    return this.sharedModel.getSource();
  }

  fromString(value: string): void {
    // TODO: Add content to shared model
    console.info("DrawIODocumentModel.fromString():", value);
    this.sharedModel.setSource(value);
  }

  toJSON(): PartialJSONValue {
    // TODO: Return content from shared model
    console.info(
      'DrawIODocumentModel.toJSON():',
      JSON.parse(this.sharedModel.getSource())
    );
    throw new Error('not implemented');
    return JSON.parse(this.sharedModel.getSource());
  }

  fromJSON(value: ReadonlyPartialJSONValue): void {
    // TODO: Add content to shared model
    console.info('DrawIODocumentModel.fromJSON():', value);
    throw new Error('not implemented');
    this.sharedModel.setSource(value.toString());
  }

  initialize(): void {
    //console.warn('initialize(): Not implemented');
  }

  private _dirty = false;
  private _readOnly = false;
  private _isDisposed = false;
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
}

export type XMLChange = {
  graphChanged?: Delta<Y.YXmlEvent>;
  rootChanged?: Delta<Y.YXmlEvent>;
  contextChange?: MapChange;
};

/**
 * Text/Markdown/Code files are represented as ISharedFile
 */
export interface ISharedXMLFile extends ISharedDocument {
  /**
   * The changed signal.
   */
  readonly changed: ISignal<this, XMLChange>;
  /**
   * Gets cell's source.
   *
   * @returns Cell's source.
   */
  getSource(): string;

  /**
   * Sets cell's source.
   *
   * @param value: New source.
   */
  setSource(value: string): void;

  /**
   * Replace content from `start' to `end` with `value`.
   *
   * @param start: The start index of the range to replace (inclusive).
   *
   * @param end: The end index of the range to replace (exclusive).
   *
   * @param value: New source (optional).
   */
  updateSource(start: number, end: number, value?: string): void;
}

export class XMLFile extends YDocument<XMLChange> implements ISharedDocument {
  constructor() {
    super();
    this._mxGraphAttributes = this.ydoc.getMap('attributes');
    this._root = this.ydoc.getXmlFragment('root');

    this._mxGraphAttributes.observeDeep(this._modelObserver);
    this._root.observeDeep(this._cellsObserver);
  }

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _modelObserver = (events: Y.YEvent[]): void => {
    //const changes: XMLChange = {};
    //changes.graphChanged = events.find();.delta as any;
    //this._changed.emit(changes);
  };

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _cellsObserver = (events: Y.YEvent[]): void => {
    //const changes: XMLChange = {};
    //changes.graphChanged = events.find();.delta as any;
    //this._changed.emit(changes);
  };

  public static create(): XMLFile {
    return new XMLFile();
  }

  /**
   * Gets cell's source.
   *
   * @returns Cell's source.
   */
  public getSource(): string {
    console.debug("Model.getSource");
    let source = '<mxGraphModel';
    this._mxGraphAttributes.forEach((value, key) => {
      source += ` ${key}="${value}"`;
    });
    source += '><root>';

    for (let i = this._root.length - 1; i >= 0; i--) {
      let mxCell = '<mxCell';
      const cell = this._root.get(i) as Y.XmlElement;
      const cellAttrs = cell.getAttributes();
      const cellGeometry = cell.firstChild;

      for (const [key, value] of Object.entries(cellAttrs)) {
        mxCell += ` ${key}="${value}"`;
      }

      if (cellGeometry) {
        let mxGeometry = '<mxGeometry';
        for (const [key, value] of Object.entries(
          cellGeometry.getAttributes()
        )) {
          mxGeometry += ` ${key}="${value}"`;
        }
        mxCell += `>${mxGeometry} /></mxCell>`;
      } else {
        mxCell += ' />';
      }

      source += mxCell;
    }

    source += '</root></mxGraphModel>';
    return source;
  }

  /**
   * Sets cell's source.
   *
   * @param value: New source.
   */
  public setSource(value: string): void {
    console.debug("Model.setSource");
    const doc = parse(
      value,
      {
        attrNodeName: 'attr',
        textNodeName: 'text',
        attributeNamePrefix: '',
        arrayMode: false,
        ignoreAttributes: false,
        parseAttributeValue: false
      },
      true
    );
    console.debug(doc);
    const attrs = doc['mxGraphModel']['attr'];
    const cells = doc['mxGraphModel']['root']['mxCell'];

    this.transact(() => {
      // Delete previus attribute entries
      // this._mxGraphAttributes.entries.forEach( key => this._mxGraphAttributes.delete(key) );

      // Inserting attributes
      for (const [key, value] of Object.entries(attrs)) {
        this._mxGraphAttributes.set(key, value);
      }

      // Inserting mxCells
      cells.forEach((value: any) => {
        const cellAttrs = value['attr'];
        const cellGeometry = value['mxGeometry'];

        const mxCell = new Y.XmlElement('mxCell');
        // Inserting attributes
        for (const [key, value] of Object.entries(cellAttrs)) {
          //console.debug(key, value);
          mxCell.setAttribute(key, value as string);
        }

        if (cellGeometry) {
          const geometryAttrs = cellGeometry['attr'];
          const mxGeometry = new Y.XmlElement('mxGeometry');
          for (const [key, value] of Object.entries(geometryAttrs)) {
            mxGeometry.setAttribute(key, value as string);
          }
          mxCell.push([mxGeometry]);
        }

        this._root.insert(0, [mxCell]);
      });
    });
  }

  /**
   * Replace content from `start' to `end` with `value`.
   *
   * @param start: The start index of the range to replace (inclusive).
   *
   * @param end: The end index of the range to replace (exclusive).
   *
   * @param value: New source (optional).
   */
  public updateSource(start: number, end: number, value = ''): void {
    this.transact(() => {
      //this._source.delete(start, end - start);
      //this._source.insert(0, [new XmlElement(value)]);
    });
  }

  private _mxGraphAttributes: Y.Map<any>;
  private _root: Y.XmlFragment;
}
