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

import { ISharedFile, YDocument, YFile, Delta } from '@jupyterlab/shared-models';

import { IChangedArgs } from '@jupyterlab/coreutils';

import { IModelDB, ModelDB } from '@jupyterlab/observables';

import { PartialJSONValue, ReadonlyPartialJSONValue } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';

import {
	XmlFragment,
	XmlElement,
	XmlText,
	YEvent,
	YXmlEvent
} from 'yjs';


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

	readonly sharedModel: ISharedFile = YFile.create();
	
	dispose(): void {
		this._isDisposed = true;
	}

	toString(): string {
		// TODO: Return content from shared model
		//console.info("DrawIODocumentModel.toString():", this.sharedModel.getSource());
		return this.sharedModel.getSource();
	}
	
	fromString(value: string): void {
		// TODO: Add content to shared model
		//console.info("DrawIODocumentModel.fromString():", value);
		this.sharedModel.setSource(value);
	}
	
	toJSON(): PartialJSONValue {
		// TODO: Return content from shared model
		console.warn("toJSON(): Not implemented");
		return {};
	}
	
	fromJSON(value: ReadonlyPartialJSONValue): void {
		// TODO: Add content to shared model
		console.warn("fromJSON(): Not implemented");
	}
	
	initialize(): void {}
	
	private _dirty = false;
	private _readOnly = false;
	private _isDisposed = false;
	private _contentChanged = new Signal<this, void>(this);
	private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
}

export type XMLChange = {
  graphChanged?: Delta<YXmlEvent>;
  rootChanged?: Delta<YXmlEvent>;
};

export class XMLModel extends YDocument<XMLChange> {
	constructor() {
    super();
		this._mxGraphModel = this.ydoc.getXmlFragment('mxGraphModel');
		this._root = new XmlElement();
		this._mxGraphModel.observeDeep(this._modelObserver);
		this.transact(() => {
			this._mxGraphModel.insert(0, [this._root]);
		});
  }

  /**
   * Handle a change to the _mxGraphModel.
   */
  private _modelObserver = (events: YEvent[]) => {
    const changes: XMLChange = {};
    //changes.graphChanged = events.find();.delta as any;
    this._changed.emit(changes);
  };

  public static create(): XMLModel {
    return new XMLModel();
  }

  /**
   * Gets cell's source.
   *
   * @returns Cell's source.
   */
  public getGraphModel(): string {
    return this._mxGraphModel.toString();
  }

  /**
   * Sets cell's source.
   *
   * @param value: New source.
   */
  public setSource(value: string): void {
    this.transact(() => {
      const text = this._root;
      text.delete(0, text.length);
      text.insert(0, [new XmlText(value)]);
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
      const source = this._root;
      source.delete(start, end - start);
      source.insert(start, [new XmlText(value)]);
    });
  }

  private _mxGraphModel: XmlFragment;
	private _root: XmlElement;
}