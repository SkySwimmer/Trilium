import { Dropdown as BootstrapDropdown } from "bootstrap";
import { ComponentChildren } from "preact";
import Icon from "./Icon";
import { useEffect, useMemo, useRef, type CSSProperties } from "preact/compat";

interface FormListOpts {
    children: ComponentChildren;
    onSelect?: (value: string) => void;
    style?: CSSProperties;
    fullHeight?: boolean;
}

export default function FormList({ children, onSelect, style, fullHeight }: FormListOpts) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!triggerRef.current || !wrapperRef.current) {
            return;
        }
        
        const $wrapperRef = $(wrapperRef.current);
        const dropdown = BootstrapDropdown.getOrCreateInstance(triggerRef.current);
        $wrapperRef.on("hide.bs.dropdown", (e) => e.preventDefault());

        return () => {
            $wrapperRef.off("hide.bs.dropdown");
            dropdown.dispose();
        }
    }, [ triggerRef, wrapperRef ]);

    const builtinStyles = useMemo(() => {
        const style: CSSProperties = {};
        if (fullHeight) {
            style.height = "100%";
        }
        return style;
    }, [ fullHeight ]);

    return (
        <div className="dropdownWrapper" ref={wrapperRef} style={builtinStyles}>
            <div className="dropdown" style={builtinStyles}>
                <button
                    ref={triggerRef}
                    type="button" style="display: none;"
                    data-bs-toggle="dropdown" data-bs-display="static">
                </button>

                <div class="dropdown-menu static show" style={{
                    ...style ?? {},
                    ...builtinStyles,
                    position: "relative",
                }} onClick={(e) => {
                    const value = (e.target as HTMLElement)?.dataset?.value;
                    if (value && onSelect) {
                        onSelect(value);
                    }
                }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

interface FormListItemOpts {
    children: ComponentChildren;
    icon?: string;
    value?: string;
    title?: string;
    active?: boolean;
}

export function FormListItem({ children, icon, value, title, active }: FormListItemOpts) {
    return (
        <a
            class={`dropdown-item ${active ? "active" : ""}`}
            data-value={value} title={title}
            tabIndex={0}
        >
            <Icon icon={icon} />&nbsp;
            {children}
        </a>
    );
}

interface FormListHeaderOpts {
    text: string;
}

export function FormListHeader({ text }: FormListHeaderOpts) {
    return (
        <li>
            <h6 className="dropdown-header">{text}</h6>
        </li>
    )
}
