import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';

import { IModelDB } from '@jupyterlab/observables';

import { Contents } from '@jupyterlab/services';

import { CommandRegistry } from '@lumino/commands';

import { DrawIODocumentWidget } from './widget';

import { DrawIODocumentModel } from './model';

import { DrawIOWidget } from './panel';

/**
 * A widget factory for drawio.
 */
export class DrawIOWidgetFactory extends ABCWidgetFactory<
  DrawIODocumentWidget,
  DrawIODocumentModel
> {
  /**
   * Create a new widget given a context.
   */
  constructor(options: DrawIOWidgetFactory.IDrawIOFactoryOptions) {
    super(options);
    this._commands = options.commands;
  }

  protected createNewWidget(
    context: DocumentRegistry.IContext<DrawIODocumentModel>
  ): DrawIODocumentWidget {
    return new DrawIODocumentWidget({
      context,
      commands: this._commands,
      content: new DrawIOWidget()
    });
  }

  private _commands: CommandRegistry;
}

export namespace DrawIOWidgetFactory {
  export interface IDrawIOFactoryOptions
    extends DocumentRegistry.IWidgetFactoryOptions {
    commands: CommandRegistry;
  }
}

export class DrawIODocumentModelFactory
	implements DocumentRegistry.IModelFactory<DrawIODocumentModel> {

	constructor() {}

	/**
   * The name of the model.
   */
	get name(): string {
    return 'dio';
  }

  /**
   * The content type of the file.
   */
  get contentType(): Contents.ContentType {
    return 'file';
  }

  /**
   * The format of the file.
   */
  get fileFormat(): Contents.FileFormat {
    return 'text';
  }

	/**
   * Get whether the model factory has been disposed.
   */
	get isDisposed(): boolean {
    return this._disposed;
  }

	dispose(): void {
		this._disposed = true;
	}

	preferredLanguage(path: string): string {
		return '';
	}

	createNew(languagePreference?: string, modelDB?: IModelDB): DrawIODocumentModel {
		return new DrawIODocumentModel(languagePreference, modelDB);
	}

	private _disposed = false;
}