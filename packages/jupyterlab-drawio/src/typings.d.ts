declare module '*.svg' {
  const script: string;
  export default script;
}

declare module '@deathbeds/jupyterlab-drawio-webpack' {
  export const DRAWIO_URL: string;
}
