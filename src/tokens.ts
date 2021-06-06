export type mxRoot = mxCell[];

export type mxCell = {
	id: number;
	parent?: number;
	value?: string;
	style?: string;
	vertex?: number;
	edge?: boolean;
	source?: number;
	geometry?: mxGeometry;
};

export type mxGeometry = {
	x?: number;
	y?: number;
	as: string;
	width?: number;
	height?: number;
	relative?: boolean;
};

export type mxPoint = {
	x: number;
	y: number;
	as: string;
};