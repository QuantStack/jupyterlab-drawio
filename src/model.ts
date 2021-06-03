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

import { parse, j2xParser, J2xOptions } from 'fast-xml-parser';

import { mxRoot, mxCell, mxGeometry } from './tokens';

type GraphObject = {
  [key: string]: any;
};

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

  readonly sharedModel: XMLFile = XMLFile.create();

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    this.sharedModel.dispose();
  }

  toString(): string {
    console.info('DrawIODocumentModel.toString():');
    const yAttr = this.sharedModel.getAttr('mxGraphModel') as Y.Map<string>;

    const root: any[] = [];
    const yRoot = this.sharedModel.getRoot();
    yRoot.forEach( value => {
      value.removeAttribute('mxElementName');
      root.push(this._parseYChild(value));
    });

    const graph: GraphObject = {};
    graph['mxGraphModel'] = {
      '#attrs': yAttr.toJSON(),
      'root': {
        'mxCell': root
      }
    };

    const defaultOptions: Partial<J2xOptions> = 
    {
      attrNodeName: '#attrs',
      textNodeName: '#text',
      attributeNamePrefix: '',
      ignoreAttributes: false
    };
    const parser = new j2xParser(defaultOptions);
    return parser.parse(graph);
  }

  fromString(value: string): void {
    console.info("DrawIODocumentModel.fromString():", value);
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

    this.sharedModel.transact( () => {
      this.sharedModel.setSource(value);
      this.sharedModel.setAttr('mxGraphModel', yAttrs);
      this.sharedModel.setRoot(yRoot);
    });
  }

  toJSON(): PartialJSONValue {
    console.info('DrawIODocumentModel.toJSON():');
    throw new Error('not implemented');
    return JSON.parse(this.sharedModel.getSource());
  }

  fromJSON(value: ReadonlyPartialJSONValue): void {
    console.info('DrawIODocumentModel.fromJSON():', value);
    throw new Error('not implemented');
    this.sharedModel.setSource(value.toString());
  }

  initialize(): void {
    //console.warn('initialize(): Not implemented');
  }

  getRoot(): mxRoot {
    console.debug("Model.getRoot");
    const root = new Array<mxCell>();
    const yroot = this.sharedModel.root;

    for (let i = 0; i < yroot.length; i++) {
      const yCell = yroot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      const yGeometry = yCellAttrs.firstChild;
      
      let geometry: mxGeometry | undefined = undefined;

      if (yGeometry) {
        const yGeometryAttrs = yGeometry.getAttributes();
        geometry = {
          x: yGeometryAttrs['x'],
          y: yGeometryAttrs['y'],
          width: yGeometryAttrs['width'],
          height: yGeometryAttrs['height'],
          as: yGeometryAttrs['as']
        };
      }
      
      const cell: mxCell = {
        id: yCellAttrs['id'],
        parent: yCellAttrs['parent'],
        value: yCellAttrs['value'],
        style: yCellAttrs['style'],
        vertex: yCellAttrs['vertex'],
        geometry: geometry
      };
      
      console.debug("cell:", cell);
      root.push(cell);
    }

    return root;
  }

  setRoot(root: mxRoot): void {
    console.debug("Model.setRoot", root);
    const yCells = Array<Y.XmlElement>();

    root.forEach( (cell: mxCell) => {
      const yCell = new Y.XmlElement('mxCell');

      yCell.setAttribute('id', cell.id.toString());
      if (cell.parent) {
        yCell.setAttribute('parent', cell.parent.toString());
      }
      if (cell.value) {
        yCell.setAttribute('value', cell.value);
      }
      if (cell.style) {
        yCell.setAttribute('style', cell.style);
      }
      if (cell.vertex) {
        yCell.setAttribute('vertex', cell.vertex.toString());
      }

      if (cell.geometry) {
        const geometry = cell.geometry;
        const yGeometry = new Y.XmlElement('mxGeometry');
        yGeometry.setAttribute('x', geometry.x.toString());
        yGeometry.setAttribute('y', geometry.y.toString());
        yGeometry.setAttribute('width', geometry.width.toString());
        yGeometry.setAttribute('height', geometry.height.toString());
        yGeometry.setAttribute('as', geometry.as);
        yCell.insert(0, [yGeometry]);
      }

      yCells.push(yCell);
    });

    this.sharedModel.updateRoot(0, this.sharedModel.root.length, yCells);
  }

  getCell(id: number): mxCell {
    console.debug("Model.getCell", id);
    const yRoot = this.sharedModel.root;

    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      
      if (yCellAttrs['id'] == id) {
        const yGeometry = yCellAttrs.firstChild;
        let geometry: mxGeometry | undefined = undefined;

        if (yGeometry) {
          const yGeometryAttrs = yGeometry.getAttributes();
          geometry = {
            x: yGeometryAttrs['x'],
            y: yGeometryAttrs['y'],
            width: yGeometryAttrs['width'],
            height: yGeometryAttrs['height'],
            as: yGeometryAttrs['as']
          };
        }
        
        return {
          id: yCellAttrs['id'],
          parent: yCellAttrs['parent'],
          value: yCellAttrs['value'],
          style: yCellAttrs['style'],
          vertex: yCellAttrs['vertex'],
          geometry: geometry
        };
      }
    }

    return null;
  }

  setCell(cell: mxCell): void {
    console.debug("Model.setCell", cell);
    const yRoot = this.sharedModel.root;
    let index = -1;
    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      if (yCellAttrs['id'] == cell.id) {
        index = i;
        break;
      }
    }

    const yCell = new Y.XmlElement('mxCell');
    yCell.setAttribute('id', cell.id.toString());
    if (cell.parent) {
      yCell.setAttribute('parent', cell.parent.toString());
    }
    if (cell.value) {
      yCell.setAttribute('value', cell.value);
    }
    if (cell.style) {
      yCell.setAttribute('style', cell.style);
    }
    if (cell.vertex) {
      yCell.setAttribute('vertex', cell.vertex.toString());
    }

    if (cell.geometry) {
      const geometry = cell.geometry;
      const yGeometry = new Y.XmlElement('mxGeometry');
      yGeometry.setAttribute('x', geometry.x.toString());
      yGeometry.setAttribute('y', geometry.y.toString());
      yGeometry.setAttribute('width', geometry.width.toString());
      yGeometry.setAttribute('height', geometry.height.toString());
      yGeometry.setAttribute('as', geometry.as);
      yCell.insert(0, [yGeometry]);
    }

    console.debug(yCell);
    this.sharedModel.updateRoot(index, 1, [yCell]);
  }

  getGeometry(id: number): mxGeometry {
    console.debug("Model.getGeometry", id);
    const yRoot = this.sharedModel.root;

    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      
      if (yCellAttrs['id'] == id) {
        const yGeometry = yCellAttrs.firstChild;

        if (yGeometry) {
          const yGeometryAttrs = yGeometry.getAttributes();
          return {
            x: yGeometryAttrs['x'],
            y: yGeometryAttrs['y'],
            width: yGeometryAttrs['width'],
            height: yGeometryAttrs['height'],
            as: yGeometryAttrs['as']
          };
        }
        
        return null;
      }
    }

    return null;
  }

  setGeometry(id: number, geometry: mxGeometry): void {
    console.debug("Model.setGeometry", id, geometry);
    const yRoot = this.sharedModel.root;
    let index = -1;
    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      if (yCellAttrs['id'] == id) {
        index = i;
        break;
      }
    }

    if (index == -1) {
      return;
    }

    const yGeometry = new Y.XmlElement('mxGeometry');
    yGeometry.setAttribute('x', geometry.x.toString());
    yGeometry.setAttribute('y', geometry.y.toString());
    yGeometry.setAttribute('width', geometry.width.toString());
    yGeometry.setAttribute('height', geometry.height.toString());
    yGeometry.setAttribute('as', geometry.as);

    this.sharedModel.transact(() => {
      const yCell = yRoot.get(index) as Y.XmlElement;
      yCell.delete(0, 1);
      yCell.insert(0, [yGeometry]);
    });
  }

  getValue(id: number): string {
    console.debug("Model.getValue", id);
    const yRoot = this.sharedModel.root;

    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      
      if (yCellAttrs['id'] == id) {

        if (yCellAttrs['value']) {
          return yCellAttrs['value']
        }
        
        return null;
      }
    }

    return null;
  }

  setValue(id: number, value: string): void {
    console.debug("Model.setValue", id, value);
    const yRoot = this.sharedModel.root;
    let index = -1;
    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      if (yCellAttrs['id'] == id) {
        index = i;
        break;
      }
    }

    if (index == -1) {
      return;
    }

    this.sharedModel.transact(() => {
      const yCell = yRoot.get(index) as Y.XmlElement;
      yCell.setAttribute('value', value);
    });
  }

  getStyle(id: number): string {
    console.debug("Model.getValue", id);
    const yRoot = this.sharedModel.root;

    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      
      if (yCellAttrs['id'] == id) {

        if (yCellAttrs['style']) {
          return yCellAttrs['style']
        }
        
        return null;
      }
    }

    return null;
  }

  setStyle(id: number, style: string): void {
    console.debug("Model.setStyle", id, style);
    const yRoot = this.sharedModel.root;
    let index = -1;
    for (let i = 0; i < yRoot.length; i++) {
      const yCell = yRoot.get(i) as Y.XmlElement;
      const yCellAttrs = yCell.getAttributes();
      if (yCellAttrs['id'] == id) {
        index = i;
        break;
      }
    }

    if (index == -1) {
      return;
    }

    this.sharedModel.transact(() => {
      const yCell = yRoot.get(index) as Y.XmlElement;
      yCell.setAttribute('style', style);
    });
  }

  private _parseJSONChild = (tag: string, element: any): Y.XmlText | Y.XmlElement  => {
    const yElement = new Y.XmlElement(tag);
    yElement.setAttribute("mxElementName", tag);

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
        child.forEach( value => {
          yElement.push([this._parseJSONChild(key, value)]);
        });

      } else {
        yElement.push([this._parseJSONChild(key, child)]);
      }
    }
    
    return yElement;
  }

  private _parseYChild = (yElement: Y.XmlText | Y.XmlElement): GraphObject  => {
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
      yElement.slice(0, yElement.length).forEach( yChild => {
        const tag = yChild.getAttribute('mxElementName');
        yChild.removeAttribute('mxElementName');
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
  }

  private _dirty = false;
  private _readOnly = false;
  private _isDisposed = false;
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
}

export type XMLChange = {
  contextChange?: MapChange;
  mxRootChange?: Delta<Y.XmlElement>;
  mxChildChange?: Delta<Y.XmlElement>;
  mxGeometryChange?: Delta<Y.XmlElement>;
  mxTerminalChange?: Delta<Y.XmlElement>;
  mxValueChange?: {
    id: number;
    value: string;
  };
  mxStyleChange?: {
    id: number;
    style: string;
  };
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

    this._attr.observeDeep(this._modelObserver);
    this._root.observeDeep(this._cellsObserver);
  }

  get root(): Y.XmlFragment {
    return this._root;
  }

  /**
   * Dispose of the resources.
   */
  dispose(): void {
    this._attr.unobserveDeep(this._modelObserver);
    this._root.unobserveDeep(this._cellsObserver);
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
      this.source.insert(0, value);
    });
  }

  /**
   * Returns an attribute.
   *
   * @param key: The key of the attribute.
   */
  public getAttr(key: string): any {
    //console.debug("getAttrs:", key);
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
    //console.debug("setAttr:", key, value);
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
    //console.debug("updateAttr:", key, value);
    this._attr.set(key, value);
  }

  /**
   * Gets elements.
   *
   * @returns elements.
   */
  public getRoot(): (Y.XmlElement | Y.XmlText)[] {
    //console.debug("setRoot:", this._root.slice());
    return this._root.slice();
  }

  /**
   * Sets elements.
   *
   * @param root: New elements.
   */
  public setRoot(root: (Y.XmlElement | Y.XmlText)[]): void {
    //console.debug("setRoot:", root);
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
  public updateRoot(start: number, end: number, value: (Y.XmlElement | Y.XmlText)[]): void {
    //console.debug("updateRoot:", start, end);
    //console.debug(value);
    this.transact(() => {
      this._root.delete(start, end - start);
      this._root.insert(0, value);
    });
  }

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _modelObserver = (events: Y.YEvent[]): void => {
    console.debug("_modelObserver:", events);
    //const changes: XMLChange = {};
    //changes.graphChanged = events.find();.delta as any;
    //this._changed.emit(changes);
  };

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _cellsObserver = (events: Y.YEvent[]): void => {
    console.debug("_cellsObserver:", events);
    /* const changes: XMLChange = {};
    const event = events.find(event => event.target === this._root);
    if (event) {
      changes.mxRootChange = event.changes.delta as any;
    }
    this._changed.emit(changes); */
  };

  private _attr: Y.Map<any>;
  private _root: Y.XmlFragment;
}
