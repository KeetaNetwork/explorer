declare module '*.svg?react' {
    import type { FunctionComponent, JSX } from 'preact';
    const ReactComponent: FunctionComponent<JSX.SVGAttributes<SVGSVGElement>>;
    export { ReactComponent as default };
}