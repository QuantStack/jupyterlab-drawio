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

import { YDocument, MapChange, createMutex } from '@jupyterlab/shared-models';

import { IChangedArgs } from '@jupyterlab/coreutils';

import { IModelDB, ModelDB } from '@jupyterlab/observables';

import { PartialJSONValue, ReadonlyPartialJSONValue } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import * as Y from 'yjs';

export class DrawIODocumentModel implements DocumentRegistry.IModel {
  /**
   * Construct a new DrawIODocumentModel.
   */
  constructor(languagePreference?: string, modelDB?: IModelDB) {
    this.modelDB = modelDB || new ModelDB();

    this.sharedModel.changed.connect(this._onSharedModelChanged);
  }

  get dirty(): boolean {
    return this.sharedModel.getState('dirty');
  }

  set dirty(newValue: boolean) {
    this.sharedModel.setState('dirty', newValue);
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
  }

  toString(): string {
    let source = '<mxGraphModel';
    this.sharedModel.attrs.forEach((value, key) => {
      source += ` ${key}="${value}"`;
    });

    source += '>\n\t<root>';

    this.sharedModel.root.forEach(value => {
      source += `\n\t\t${value}`;
    });

    source += '\n\t</root>\n</mxGraphModel>';
    return source;
  }

  fromString(source: string): void {
    const patternGraph = new RegExp(/<mxGraphModel(?:[^<]?)*>/g);
    const graph = source.match(patternGraph);

    const patternAttrs = new RegExp(/\w+="[^"]*"/g);
    const attrs = graph[0].match(patternAttrs);

    const patternCells = new RegExp(
      /(?:<mxCell[^<]*\/>)|(?:<mxCell(?:[^<]?)*>((?:.|[\n\r])*?)<\/mxCell>)/g
    );
    const cells = source.match(patternCells);

    this.transact(() => {
      //this.sharedModel.setSource(source);

      attrs.forEach(attr => {
        const patternAttr = new RegExp(/(?<key>\w+)="(?<value>[^"]*)"/g);
        const res = patternAttr.exec(attr);
        this.sharedModel.setAttr(res[1], res[2]);
      });

      cells.forEach(value => {
        const patternCell = new RegExp(/id="(?<id>[^"]*)"/g);
        const res = patternCell.exec(value);
        this.sharedModel.setCell(res[1], value);
      });
    });
  }

  toJSON(): PartialJSONValue {
    throw new Error('Not implemented');
  }

  fromJSON(source: ReadonlyPartialJSONValue): void {
    throw new Error('Not implemented');
  }

  initialize(): void {
    this.sharedModel.setState('dirty', false);
  }

  transact(cb: () => void): void {
    this.sharedModel.transact(cb);
  }

  getGraph(): string {
    let source = '<root>';
    this.sharedModel.root.forEach((value, id) => {
      if (id !== '0' && id !== '1') {
        source += value;
      }
    });
    source += '</root>';
    return source;
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

  private _onSharedModelChanged = (
    sender: YDrawIO,
    changes: IDrawIOChange
  ): void => {
    console.debug("State changed:");
    if (changes.stateChange) {
      changes.stateChange.forEach( state => {
        console.debug("State changed:", state);
        if (state.name === 'dirty') {
          this._stateChanged.emit({
            name: 'dirty',
            oldValue: state.oldValue,
            newValue: state.newValue
          });
        }
      });

    } else {
      this.dirty = true;
      this._sharedModelChanged.emit(changes);
    }
  };

  private _readOnly = false;
  private _isDisposed = false;
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _sharedModelChanged = new Signal<this, IDrawIOChange>(this);
}

export type IDrawIOChange = {
  contextChange?: MapChange;
  stateChange?: Array<{
    name: string;
    oldValue: any;
    newValue: any;
  }>;
  attrChange?: MapChange;
  cellChange?: boolean;
};

export class YDrawIO extends YDocument<IDrawIOChange> {
  constructor() {
    super();
    this._state = this.ydoc.getMap('state');
    this._attrs = this.ydoc.getMap('attrs');
    this._root = this.ydoc.getMap('root');

    this._state.observe(this._stateObserver);
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
    this._state.unobserve(this._stateObserver);
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
   * Returns a state attribute.
   *
   * @param key: The key of the attribute.
   */
  public getState(key: string): any {
    return this._state.get(key);
  }

  /**
   * Adds new state attribute.
   *
   * @param key: The key of the attribute.
   *
   * @param value: New source.
   */
  public setState(key: string, value: any): void {
    this._state.set(key, value);
  }

  /**
   * Remove a state attribute.
   *
   * @param key: The key of the attribute.
   */
  public removeState(key: string): void {
    this._state.delete(key);
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
  private _stateObserver = (event: Y.YMapEvent<any>): void => {
    const stateChange = new Array();

    if (event.keysChanged.has('dirty')) {
      const change = event.changes.keys.get('dirty');
      stateChange.push({
        name: 'dirty',
        oldValue: change?.oldValue === true ? true : false,
        newValue: this._state.get('dirty')
      });
    }

    this._changed.emit({ stateChange });
  };

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _rootObserver = (event: Y.YMapEvent<any>): void => {
    const changes: IDrawIOChange = {
      cellChange: true
    };
    this._changed.emit(changes);
  };

  private _state: Y.Map<any>;
  private _attrs: Y.Map<any>;
  private _root: Y.Map<any>;
}
