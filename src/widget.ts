import { Widget } from '@lumino/widgets';

import { Signal, ISignal } from '@lumino/signaling';

import { PromiseDelegate } from '@lumino/coreutils';

/*
	This is a typing-only import. If you use it directly, the mxgraph content
  will be included in the main JupyterLab js bundle.
*/
// @ts-ignore
import * as MX from './drawio/modulated.js';

import './drawio/css/common.css';

import './drawio/styles/grapheditor.css';

import { grapheditorTxt, defaultXml } from './pack';

const w = window as any;
const webPath =
  'https://raw.githubusercontent.com/jgraph/mxgraph/master/javascript/examples/grapheditor/www/';

w.RESOURCES_BASE = webPath + 'resources/';
w.STENCIL_PATH = webPath + 'stencils/';
w.IMAGE_PATH = webPath + 'images/';
w.STYLE_PATH = webPath + 'styles/';
w.CSS_PATH = webPath + 'styles/';
w.OPEN_FORM = webPath + 'open.html';

// w.mxBasePath = "http://localhost:8000/src/mxgraph/javascript/src/";
//w.imageBasePath = 'http://localhost:8000/src/mxgraph/javascript/';
w.mxLoadStylesheets = false; // disable loading stylesheets
w.mxLoadResources = false;

/**
 * A DrawIO layout.
 */
export class DrawIOWidget extends Widget {
  /**
   * Construct a `GridStackLayout`.
   *
   * @param info - The `DashboardView` metadata.
   */
  constructor() {
    super();
    void Private.ensureMx().then(mx => this._loadDrawIO(mx));
    //this._loadDrawIO(MX);
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    Signal.clearData(this);
    this._editor.destroy();
    super.dispose();
  }

  /**
   * A promise that resolves when the csv viewer is ready.
   */
  get ready(): PromiseDelegate<void> {
    return this._ready;
  }

  get graphChanged(): ISignal<this, string> {
    return this._graphChanged;
  }

  get mx(): any {
    return this._mx;
  }

  get editor(): any {
    return this._editor;
  }

  get graph(): any {
    return this._editor.editor.graph;
  }

  getAction(action: string): any {
    return this._editor.actions.actions[action];
  }

  getActions(): any {
    return this._editor.actions.actions;
  }

  setContent(newValue: string): void {
    if (this._editor === undefined) {
      return;
    }

    const oldValue = this._mx.mxUtils.getXml(this._editor.editor.getGraphXml());

    if (oldValue !== newValue && !this._editor.editor.graph.isEditing()) {
      if (newValue.length) {
        const xml = this._mx.mxUtils.parseXml(newValue);
        this._editor.editor.setGraphXml(xml.documentElement);
      }
    }
  }

  //Direction
  public toggleCellStyles(flip: string): void {
    let styleFlip = this._editor.mx.mxConstants.STYLE_FLIPH;
    switch (flip) {
      case 'flipH':
        styleFlip = this._editor.mx.mxConstants.STYLE_FLIPH;
        break;
      case 'flipV':
        styleFlip = this._editor.mx.mxConstants.STYLE_FLIPV;
        break;
    }
    this._editor.graph.toggleCellStyles(styleFlip, false);
  }

  //Align
  public alignCells(align: string): void {
    if (this._editor.graph.isEnabled()) {
      let pos = this._editor.mx.mxConstants.ALIGN_CENTER;
      switch (align) {
        case 'alignCellsLeft':
          pos = this._editor.mx.mxConstants.ALIGN_LEFT;
          break;
        case 'alignCellsCenter':
          pos = this._editor.mx.mxConstants.ALIGN_CENTER;
          break;
        case 'alignCellsRight':
          pos = this._editor.mx.mxConstants.ALIGN_RIGHT;
          break;
        case 'alignCellsTop':
          pos = this._editor.mx.mxConstants.ALIGN_TOP;
          break;
        case 'alignCellsMiddle':
          pos = this._editor.mx.mxConstants.ALIGN_MIDDLE;
          break;
        case 'alignCellsBottom':
          pos = this._editor.mx.mxConstants.ALIGN_BOTTOM;
          break;
      }
      this._editor.graph.alignCells(pos);
    }
  }

  //Distribute
  //drawio:command/horizontal
  //drawio:command/vertical
  public distributeCells(horizontal: boolean): void {
    this._editor.graph.distributeCells(horizontal);
  }

  //Layout
  //drawio:command/horizontalFlow
  //drawio:command/verticalFlow
  public layoutFlow(direction: string): void {
    let directionFlow = this._editor.mx.mxConstants.DIRECTION_WEST;
    switch (direction) {
      case 'horizontalFlow':
        directionFlow = this._editor.mx.mxConstants.DIRECTION_WEST;
        break;
      case 'verticalFlow':
        directionFlow = this._editor.mx.mxConstants.DIRECTION_NORTH;
        break;
    }

    const mxHierarchicalLayout = this._editor.mx.mxHierarchicalLayout;
    const layout = new mxHierarchicalLayout(this._editor.graph, directionFlow);

    this._editor.editor.executeLayout(() => {
      const selectionCells = this._editor.graph.getSelectionCells();
      layout.execute(
        this._editor.graph.getDefaultParent(),
        selectionCells.length === 0 ? null : selectionCells
      );
    }, true);
  }

  public horizontalTree(): void {
    let tmp = this._editor.graph.getSelectionCell();
    let roots = null;

    if (
      tmp === null ||
      this._editor.graph.getModel().getChildCount(tmp) === 0
    ) {
      if (this._editor.graph.getModel().getEdgeCount(tmp) === 0) {
        roots = this._editor.graph.findTreeRoots(
          this._editor.graph.getDefaultParent()
        );
      }
    } else {
      roots = this._editor.graph.findTreeRoots(tmp);
    }

    if (roots !== null && roots.length > 0) {
      tmp = roots[0];
    }

    if (tmp !== null) {
      const mxCompactTreeLayout = this._editor.mx.mxCompactTreeLayout;
      const layout = new mxCompactTreeLayout(this._editor.graph, true);
      layout.edgeRouting = false;
      layout.levelDistance = 30;

      this._promptSpacing(
        layout.levelDistance,
        this._editor.mx.mxUtils.bind(this, (newValue: any) => {
          layout.levelDistance = newValue;

          this._editor.editor.executeLayout(() => {
            layout.execute(this._editor.graph.getDefaultParent(), tmp);
          }, true);
        })
      );
    }
  }

  public verticalTree(): void {
    let tmp = this._editor.graph.getSelectionCell();
    let roots = null;

    if (
      tmp === null ||
      this._editor.graph.getModel().getChildCount(tmp) === 0
    ) {
      if (this._editor.graph.getModel().getEdgeCount(tmp) === 0) {
        roots = this._editor.graph.findTreeRoots(
          this._editor.graph.getDefaultParent()
        );
      }
    } else {
      roots = this._editor.graph.findTreeRoots(tmp);
    }

    if (roots !== null && roots.length > 0) {
      tmp = roots[0];
    }

    if (tmp !== null) {
      const mxCompactTreeLayout = this._editor.mx.mxCompactTreeLayout;
      const layout = new mxCompactTreeLayout(this._editor.graph, false);
      layout.edgeRouting = false;
      layout.levelDistance = 30;

      this._promptSpacing(
        layout.levelDistance,
        this._editor.mx.mxUtils.bind(this, (newValue: any) => {
          layout.levelDistance = newValue;

          this._editor.editor.executeLayout(() => {
            layout.execute(this._editor.graph.getDefaultParent(), tmp);
          }, true);
        })
      );
    }
  }

  public radialTree(): void {
    let tmp = this._editor.graph.getSelectionCell();
    let roots = null;

    if (
      tmp === null ||
      this._editor.graph.getModel().getChildCount(tmp) === 0
    ) {
      if (this._editor.graph.getModel().getEdgeCount(tmp) === 0) {
        roots = this._editor.graph.findTreeRoots(
          this._editor.graph.getDefaultParent()
        );
      }
    } else {
      roots = this._editor.graph.findTreeRoots(tmp);
    }

    if (roots !== null && roots.length > 0) {
      tmp = roots[0];
    }

    if (tmp !== null) {
      const mxRadialTreeLayout = this._editor.mx.mxRadialTreeLayout;
      const layout = new mxRadialTreeLayout(this._editor.graph, false);
      layout.levelDistance = 80;
      layout.autoRadius = true;

      this._promptSpacing(
        layout.levelDistance,
        this._editor.mx.mxUtils.bind(this, (newValue: any) => {
          layout.levelDistance = newValue;

          this._editor.editor.executeLayout(() => {
            layout.execute(this._editor.graph.getDefaultParent(), tmp);

            if (!this._editor.graph.isSelectionEmpty()) {
              tmp = this._editor.graph.getModel().getParent(tmp);

              if (this._editor.graph.getModel().isVertex(tmp)) {
                this._editor.graph.updateGroupBounds(
                  [tmp],
                  this._editor.graph.gridSize * 2,
                  true
                );
              }
            }
          }, true);
        })
      );
    }
  }

  public organic(): void {
    const mxFastOrganicLayout = this._editor.mx.mxFastOrganicLayout;
    const layout = new mxFastOrganicLayout(this._editor.graph);

    this._promptSpacing(
      layout.forceConstant,
      this._editor.mx.mxUtils.bind(this, (newValue: any) => {
        layout.forceConstant = newValue;

        this._editor.editor.executeLayout(() => {
          let tmp = this._editor.graph.getSelectionCell();

          if (
            tmp === null ||
            this._editor.graph.getModel().getChildCount(tmp) === 0
          ) {
            tmp = this._editor.graph.getDefaultParent();
          }

          layout.execute(tmp);

          if (this._editor.graph.getModel().isVertex(tmp)) {
            this._editor.graph.updateGroupBounds(
              [tmp],
              this._editor.graph.gridSize * 2,
              true
            );
          }
        }, true);
      })
    );
  }

  public circle(): void {
    const mxCircleLayout = this._editor.mx.mxCircleLayout;
    const layout = new mxCircleLayout(this._editor.graph);

    this._editor.editor.executeLayout(() => {
      let tmp = this._editor.graph.getSelectionCell();

      if (
        tmp === null ||
        this._editor.graph.getModel().getChildCount(tmp) === 0
      ) {
        tmp = this._editor.graph.getDefaultParent();
      }

      layout.execute(tmp);

      if (this._editor.graph.getModel().isVertex(tmp)) {
        this._editor.graph.updateGroupBounds(
          [tmp],
          this._editor.graph.gridSize * 2,
          true
        );
      }
    }, true);
  }

  private _loadDrawIO(mx: Private.MX): void {
    this._mx = mx;

    // Adds required resources (disables loading of fallback properties, this can only
    // be used if we know that all keys are defined in the language specific file)
    this._mx.mxResources.loadDefaultBundle = false;

    // Fixes possible asynchronous requests
    this._mx.mxResources.parse(grapheditorTxt);
    const oParser = new DOMParser();
    const oDOM = oParser.parseFromString(defaultXml, 'text/xml');
    const themes: any = new Object(null);
    themes[(this._mx.Graph as any).prototype.defaultThemeName] =
      oDOM.documentElement;

    // Workaround for TS2351: Cannot use 'new' with an expression whose type lacks a call or construct signature
    const Editor: any = this._mx.Editor;
    this._editor = new this._mx.EditorUi(new Editor(false, themes), this.node);
    this._editor.refresh();

    this._editor.editor.graph.model.addListener(
      this._mx.mxEvent.NOTIFY,
      (sender: any, evt: any) => {
        const changes: any[] = evt.properties.changes;
        for (let i = 0; i < changes.length; i++) {
          if (changes[i].root) {
            return;
          }
        }

        if (this._editor.editor.graph.isEditing()) {
          this._editor.editor.graph.stopEditing();
        }

        const graph = this._editor.editor.getGraphXml();
        const xml = this._mx.mxUtils.getXml(graph);
        this._graphChanged.emit(xml);
      }
    );

    this._promptSpacing = this._mx.mxUtils.bind(
      this,
      (defaultValue: any, fn: any) => {
        const FilenameDialog = this._mx.FilenameDialog;
        const dlg = new FilenameDialog(
          this._editor.editor,
          defaultValue,
          this._mx.mxResources.get('apply'),
          (newValue: any) => {
            fn(parseFloat(newValue));
          },
          this._mx.mxResources.get('spacing')
        );
        this._editor.editor.showDialog(dlg.container, 300, 80, true, true);
        dlg.init();
      }
    );

    this._ready.resolve(void 0);
  }

  private _editor: any;
  //@ts-ignore
  private _mx: Private.MX;
  private _promptSpacing: any;
  private _ready = new PromiseDelegate<void>();
  private _graphChanged = new Signal<this, string>(this);
}

/**
 * A namespace for module-level concerns like loading mxgraph
 */

namespace Private {
  export type MX = typeof MX;

  let _mx: typeof MX;
  let _mxLoading: PromiseDelegate<MX>;

  /**
   * Asynchronously load the mx bundle, or return it if already available
   */
  export async function ensureMx(): Promise<MX> {
    if (_mx) {
      return _mx;
    }

    if (_mxLoading) {
      return await _mxLoading.promise;
    }

    _mxLoading = new PromiseDelegate();
    /*eslint-disable */
    // @ts-ignore
    _mx = await import('./drawio/modulated.js');
    /*eslint-enable */

    _mxLoading.resolve(_mx);
    return _mx;
  }
}
