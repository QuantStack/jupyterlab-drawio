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

import { ISharedDocument, YFile } from '@jupyterlab/shared-models';

import { IChangedArgs } from '@jupyterlab/coreutils';

import { IModelDB, ModelDB } from '@jupyterlab/observables';

import { PartialJSONValue, ReadonlyPartialJSONValue } from '@lumino/coreutils';

import { ISignal, Signal } from '@lumino/signaling';


export class DrawIODocumentModel implements DocumentRegistry.IModel {
	
	/**
   * Construct a new DrawIODocumentModel.
   */
	constructor(languagePreference?: string, modelDB?: IModelDB) {
		this.modelDB = modelDB || new ModelDB();
		console.debug(this.modelDB);
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

	readonly sharedModel: ISharedDocument = YFile.create();
	
	dispose(): void {
		this._isDisposed = true;
	}

	toString(): string {
		// TODO: Return content from shared model
		console.warn("toString(): Not implemented");
		return '';
	}
	
	fromString(value: string): void {
		// TODO: Add content to shared model
		console.warn("fromString(): Not implemented");
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
