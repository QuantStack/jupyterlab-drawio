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
  YDocument,
  MapChange,
  createMutex
} from '@jupyterlab/shared-models';

import { IChangedArgs } from '@jupyterlab/coreutils';

import { IModelDB, ModelDB } from '@jupyterlab/observables';

import { PartialJSONValue, ReadonlyPartialJSONValue } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import * as Y from 'yjs';

import { parse, j2xParser, J2xOptions } from 'fast-xml-parser';

export class DrawIODocumentModel implements DocumentRegistry.IModel {
  /**
   * Construct a new DrawIODocumentModel.
   */
  constructor(languagePreference?: string, modelDB?: IModelDB) {
    this.modelDB = modelDB || new ModelDB();

    this.sharedModel.changed.connect(this._onSharedModelChanged);
  }

  get dirty(): boolean {
    return this._dirty;
  }

  set dirty(newValue: boolean) {
    const oldValue = this._dirty;
    this._dirty = newValue;
    this._stateChanged.emit({ name: 'dirty', oldValue, newValue });
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

  get sharedModelChanged(): ISignal<this, IDrawIOChange> {
    return this._sharedModelChanged;
  }

  readonly defaultKernelName: string;

  readonly defaultKernelLanguage: string;

  readonly modelDB: IModelDB;

  readonly sharedModel: YDrawIO = YDrawIO.create();

  readonly mutex = createMutex();

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    //this.sharedModel.dispose();
  }

  toString(): string {
    const source = this.sharedModel.getSource() || "";
    return source;
  }

  fromString(source: string): void {
    this.sharedModel.setSource(source);
  }

  toJSON(): PartialJSONValue {
    const source = this.sharedModel.getSource() || "";
    const doc = parse(
      source,
      {
        attrNodeName: '#attrs',
        textNodeName: '#text',
        attributeNamePrefix: '',
        arrayMode: false,
        ignoreAttributes: false,
        parseAttributeValue: false
      },
      true
    );
    return doc;
  }

  fromJSON(source: ReadonlyPartialJSONValue): void {
    const defaultOptions: Partial<J2xOptions> = {
      attrNodeName: '#attrs',
      textNodeName: '#text',
      attributeNamePrefix: '',
      ignoreAttributes: false,
      indentBy: "\t"
    };
    const parser = new j2xParser(defaultOptions);
    const data = parser.parse(source);
    this.sharedModel.setSource(data);
  }

  initialize(): void {
    //console.warn('initialize(): Not implemented');
  }

  transact(cb: () => void): void {
    this.sharedModel.transact(cb);
  }

  getCell(id: string): any {
    return this.sharedModel.getCell(id);
  }

  setCell(id: string, cell: any): void {
    this.sharedModel.setCell(id, cell);
  }

  removeCell(id: string): void {
    this.sharedModel.removeCell(id);
  }

  getGraph(): string {
    if (!this.sharedModel.getCell('0')) {
      return this.toString();
    }

    let graph = "<mxGraphModel";
    this.sharedModel.attrs.forEach( (value, key) => {
      const attr = ` ${key}="${value}"`;
      console.debug(attr);
      graph += attr;
    });
    graph += "><root>";
    this.sharedModel.root.forEach( cell => {
      graph += cell;
    });
    graph += "</root></mxGraphModel>";
    console.debug(graph);
    return graph;
  }

  private _onSharedModelChanged = (
    sender: YDrawIO,
    changes: IDrawIOChange
  ): void => {
    this.dirty = true;
    this._sharedModelChanged.emit(changes);
  };

  private _dirty = false;
  private _readOnly = false;
  private _isDisposed = false;
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _sharedModelChanged = new Signal<this, IDrawIOChange>(this);
}

export type IDrawIOChange = {
  contextChange?: MapChange;
  attrChange?: MapChange;
  cellChange?: MapChange;
};

export class YDrawIO extends YDocument<IDrawIOChange> {
  constructor() {
    super();
    this._attrs = this.ydoc.getMap('attrs');
    this._root = this.ydoc.getMap('root');

    this._attrs.observe(this._attrsObserver);
    this._root.observe(this._rootObserver);
  }

  get attrs(): Y.Map<any> {
    return this._attrs;
  }

  get root(): Y.Map<any> {
    return this._root;
  }

  /**
   * Dispose of the resources.
   */
  dispose(): void {
    this._attrs.unobserve(this._attrsObserver);
    this._root.unobserve(this._rootObserver);
  }

  public static create(): YDrawIO {
    return new YDrawIO();
  }

  /**
   * Gets document's source.
   *
   * @returns Document's source.
   */
  public getSource(): string {
    return this.source.toString();
  }

  /**
   * Sets document's source.
   *
   * @param value: New source.
   */
  public setSource(value: string): void {
    this.transact(() => {
      this.source.delete(0, this.source.length);
      this.source.insert(0, value);
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
      this.source.delete(start, end - start);
      this.source.insert(start, value);
    });
  }

  /**
   * Returns an attribute.
   *
   * @param key: The key of the attribute.
   */
  public getAttr(key: string): any {
    return this._attrs.get(key);
  }

  /**
   * Adds new attribute.
   *
   * @param key: The key of the attribute.
   *
   * @param value: New source.
   */
  public setAttr(key: string, value: any): void {
    this._attrs.set(key, value);
  }

  /**
   * Remove an attribute.
   *
   * @param key: The key of the attribute.
   */
  public removeAttr(key: string): void {
    this._attrs.delete(key);
  }

  /**
   * Returns a cell.
   *
   * @param id: The id of the cell.
   */
  public getCell(id: string): any {
    return this._root.get(id);
  }

  /**
   * Adds new cell.
   *
   * @param id: The id of the cell.
   *
   * @param cell: New cell.
   */
  public setCell(id: string, cell: any): void {
    this._root.set(id, cell);
  }

  /**
   * Remove a cell.
   *
   * @param id: The id of the cell.
   */
  public removeCell(id: string): void {
    this._root.delete(id);
  }

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _attrsObserver = (event: Y.YMapEvent<any>): void => {
    const changes: IDrawIOChange = {};
    
    if (event.keysChanged.size > 0) {
      changes.attrChange = new Map<string, any>();
      event.keysChanged.forEach( key => {
        const attr = this._attrs.get(key);
        const change = event.changes.keys.get(key);
        
        changes.attrChange.set(
          key,
          {
            action: change.action,
            oldValue: change.oldValue,
            newValue: attr
          }
        );
      });
    }

    //this._changed.emit(changes);
  };

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _rootObserver = (event: Y.YMapEvent<any>): void => {
    const changes: IDrawIOChange = {};
    
    if (event.keysChanged.size > 0) {
      changes.cellChange = new Map<string, any>();
      event.keysChanged.forEach( key => {
        const cell = this._root.get(key);
        const change = event.changes.keys.get(key);
        
        changes.cellChange.set(
          key,
          {
            action: change.action,
            oldValue: change.oldValue,
            newValue: cell
          }
        );
        console.debug("Change:", changes.cellChange.get(key));
      });
    }
    
    this._changed.emit(changes);
  };

  private _attrs: Y.Map<any>;
  private _root: Y.Map<any>;
}
