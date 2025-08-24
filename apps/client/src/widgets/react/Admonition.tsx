import { ComponentChildren } from "preact";

interface AdmonitionProps {
    type: "warning" | "note" | "caution";
    children: ComponentChildren;
}

export default function Admonition({ type, children }: AdmonitionProps) {
    return (
        <div className={`admonition ${type}`} role="alert">
            {children}
        </div>
    )
}