import { Dropdown as BootstrapDropdown } from "bootstrap";
import { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface DropdownProps {
    className?: string;
    isStatic?: boolean;
    children: ComponentChildren;
}

export default function Dropdown({ className, isStatic, children }: DropdownProps) {
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!triggerRef.current) return;
        
        const dropdown = BootstrapDropdown.getOrCreateInstance(triggerRef.current);
        return () => dropdown.dispose();
    }, []); // Add dependency array

    useEffect(() => {
        if (!dropdownRef.current) return;
        
        const handleHide = () => {
            // Remove console.log from production code
        };
        
        const $dropdown = $(dropdownRef.current);
        $dropdown.on("hide.bs.dropdown", handleHide);
        
        // Add proper cleanup
        return () => {
            $dropdown.off("hide.bs.dropdown", handleHide);
        };
    }, []); // Add dependency array

    return (
        <div ref={dropdownRef} class="dropdown" style={{ display: "flex" }}>
            <button
                ref={triggerRef}
                type="button"
                style={{ display: "none" }}
                data-bs-toggle="dropdown"
                data-bs-display={ isStatic ? "static" : undefined } />

            <div class={`dropdown-menu ${className ?? ""} ${isStatic ? "static" : undefined}`}>
                {children}
            </div>
        </div>
    )
}