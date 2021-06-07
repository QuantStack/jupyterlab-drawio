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
  MapChange,
  createMutex
} from '@jupyterlab/shared-models';

import { IChangedArgs } from '@jupyterlab/coreutils';

import { IModelDB, ModelDB } from '@jupyterlab/observables';

import { PartialJSONValue, ReadonlyPartialJSONValue } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import * as Y from 'yjs';

import { parse, j2xParser, J2xOptions } from 'fast-xml-parser';

type GraphObject = {
  [key: string]: any;
};

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

  get sharedModelChanged(): ISignal<this, XMLChange> {
    return this._sharedModelChanged;
  }

  readonly defaultKernelName: string;

  readonly defaultKernelLanguage: string;

  readonly modelDB: IModelDB;

  readonly sharedModel: XMLFile = XMLFile.create();

  readonly mutex = createMutex();

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    this.sharedModel.dispose();
  }

  toString(): string {
    const yAttr = this.sharedModel.getAttr('mxGraphModel') as Y.Map<string>;

    const root: GraphObject[] = [];
    const yRoot = this.sharedModel.getRoot();
    yRoot.forEach(value => {
      //value.removeAttribute('mxnodename');
      root.push(this._parseYChild(value));
    });

    const graph: GraphObject = {};
    graph['mxGraphModel'] = {
      '#attrs': yAttr.toJSON(),
      root: {
        mxCell: root
      }
    };

    const defaultOptions: Partial<J2xOptions> = {
      attrNodeName: '#attrs',
      textNodeName: '#text',
      attributeNamePrefix: '',
      ignoreAttributes: false
    };
    const parser = new j2xParser(defaultOptions);
    return parser.parse(graph);
  }

  fromString(value: string): void {
    const doc = parse(
      value,
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
    const attrs = doc['mxGraphModel']['#attrs'];
    const root = doc['mxGraphModel']['root'];

    const yAttrs = new Y.Map<string>();
    for (const [key, value] of Object.entries(attrs)) {
      yAttrs.set(key, value as string);
    }

    const yRoot = Array<Y.XmlText | Y.XmlElement>();
    root['mxCell'].forEach((value: any) => {
      yRoot.push(this._parseJSONChild('mxCell', value));
    });

    this.mutex(() => {
      this.sharedModel.setSource(value);
      this.sharedModel.setAttr('mxGraphModel', yAttrs);
      this.sharedModel.setRoot(yRoot);
    });
  }

  toJSON(): PartialJSONValue {
    throw new Error('not implemented');
    return JSON.parse(this.sharedModel.getSource());
  }

  fromJSON(value: ReadonlyPartialJSONValue): void {
    throw new Error('not implemented');
    this.sharedModel.setSource(value.toString());
  }

  initialize(): void {
    //console.warn('initialize(): Not implemented');
  }

  transact(cb: () => void): void {
    this.sharedModel.transact(cb);
  }

  getCell(id: number): Node {
    const yRoot = this.sharedModel.root;

    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      if (yCellAttrs['id'] === id) {
        return yCell.toDOM();
      }
    }

    return null;
  }

  setCell(id: number, cell: string): void {
    const doc = parse(
      cell,
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

    const yRoot = this.sharedModel.root;
    let index = -1;
    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      if (yCellAttrs['id'] === id) {
        index = i;
        break;
      }
    }

    const yCell = this._parseJSONChild('mxCell', doc['mxCell']);

    if (index === -1) {
      // Insert new
      this.mutex(() => {
        this.sharedModel.updateRoot(yRoot.length, yRoot.length, [yCell]);
      });
    } else {
      // Update
      this.mutex(() => {
        this.sharedModel.updateRoot(index, index + 1, [yCell]);
      });
    }
  }

  removeCell(id: number): void {
    const yRoot = this.sharedModel.root;
    let index = -1;
    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      if (yCellAttrs['id'] === id) {
        index = i;
        break;
      }
    }
    // Remove
    if (index !== -1) {
      this.mutex(() => {
        this.sharedModel.updateRoot(index, index + 1, []);
      });
    }
  }

  private _parseJSONChild = (
    tag: string,
    element: any
  ): Y.XmlText | Y.XmlElement => {
    const yElement = new Y.XmlElement(tag);
    yElement.setAttribute('mxnodename', tag);

    const attrs = element['#attrs'];
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        yElement.setAttribute(key, value as string);
      }
    }

    const text = element['#text'];
    if (text) {
      yElement.push([new Y.XmlText(text)]);
    }

    for (const [key, child] of Object.entries(element)) {
      if (key === '#attrs' || key === '#text') {
        continue;
      }

      if (child instanceof Array) {
        child.forEach(value => {
          yElement.push([this._parseJSONChild(key, value)]);
        });
      } else {
        yElement.push([this._parseJSONChild(key, child)]);
      }
    }

    return yElement;
  };

  private _parseYChild = (yElement: Y.XmlText | Y.XmlElement): GraphObject => {
    const element: GraphObject = {};

    const yAttrs = yElement.getAttributes();
    if (yAttrs) {
      const attrs: GraphObject = {};
      for (const [key, value] of Object.entries(yAttrs)) {
        attrs[key] = value;
      }
      element['#attrs'] = attrs;
    }

    if (yElement instanceof Y.XmlText) {
      element['#text'] = yElement.toJSON();
    }

    if (yElement instanceof Y.XmlElement) {
      yElement.slice(0, yElement.length).forEach(yChild => {
        const tag = yChild.getAttribute('mxnodename');
        const child = this._parseYChild(yChild);

        if (element[tag] === undefined) {
          element[tag] = child;
        } else if (element[tag] instanceof Array) {
          element[tag].push(child);
        } else {
          const aux = element[tag];
          element[tag] = [aux, child];
        }
      });
    }

    return element;
  };

  private _onSharedModelChanged = (
    sender: XMLFile,
    changes: XMLChange
  ): void => {
    this._sharedModelChanged.emit(changes);
  };

  private _dirty = false;
  private _readOnly = false;
  private _isDisposed = false;
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _sharedModelChanged = new Signal<this, XMLChange>(this);
}

export type XMLChange = {
  contextChange?: MapChange;
  mxChildChange?: Delta<{
    id: number;
    oldValue: Y.XmlElement | undefined;
    newValue: Y.XmlElement | undefined;
  }>;
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

export class XMLFile extends YDocument<XMLChange> implements ISharedXMLFile {
  constructor() {
    super();
    this._attr = this.ydoc.getMap('attrs');
    this._root = this.ydoc.getXmlFragment('root');

    this._attr.observe(this._modelObserver);
    this._root.observe(this._cellsObserver);
  }

  get root(): Y.XmlFragment {
    return this._root;
  }

  /**
   * Dispose of the resources.
   */
  dispose(): void {
    this._attr.unobserve(this._modelObserver);
    this._root.unobserve(this._cellsObserver);
  }

  public static create(): XMLFile {
    return new XMLFile();
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
    return this._attr.get(key);
  }

  /**
   * Adds new attribute.
   *
   * @param key: The key of the attribute.
   *
   * @param value: New source.
   */
  public setAttr(key: string, value: any): void {
    this._attr.set(key, value);
  }

  /**
   * Replace attribute.
   *
   * @param key: The key of the attribute.
   *
   * @param value: New source.
   */
  public updateAttr(key: string, value: any): void {
    this._attr.set(key, value);
  }

  /**
   * Gets elements.
   *
   * @returns elements.
   */
  public getRoot(): (Y.XmlElement | Y.XmlText)[] {
    return this._root.slice();
  }

  /**
   * Sets elements.
   *
   * @param root: New elements.
   */
  public setRoot(root: (Y.XmlElement | Y.XmlText)[]): void {
    this.transact(() => {
      this._root.delete(0, this._root.length);
      this._root.insert(0, root);
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
  public updateRoot(
    start: number,
    end: number,
    value: (Y.XmlElement | Y.XmlText)[]
  ): void {
    this.transact(() => {
      this._root.delete(start, end - start);
      this._root.insert(start, value);
    });
  }

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _modelObserver = (event: Y.YMapEvent<any>): void => {
    // Empty
  };

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _cellsObserver = (event: Y.YXmlEvent): void => {
    this._changed.emit({});
  };

  private _attr: Y.Map<any>;
  private _root: Y.XmlFragment;
}
